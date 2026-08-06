import { Alert, Snackbar } from '@mui/material';
import { SceneItemData, SceneViewStateData } from '@vertexvis/api-client-node';
import { vertexvis } from '@vertexvis/frame-streaming-protos';
import {
  DomainPropertyEntry,
  Environment,
  SceneItemMetadataResponse,
  TapEventDetails,
} from '@vertexvis/viewer';
import { GetServerSidePropsContext, GetServerSidePropsResult } from 'next';
import { useRouter } from 'next/router';
import { withIronSession } from 'next-iron-session';
import React from 'react';
import useSWR, { SWRResponse } from 'swr';

import { Header } from '../../components/shared/Header';
import { Layout } from '../../components/viewer/Layout';
import { LeftDrawer } from '../../components/viewer/LeftDrawer';
import { LeftSidebar } from '../../components/viewer/LeftSidebar';
import { MetadataStatus } from '../../components/viewer/MetadataStates';
import { PolicySelect } from '../../components/viewer/PolicySelect';
import { RightDrawer } from '../../components/viewer/RightDrawer';
import { RightSidebar } from '../../components/viewer/RightSidebar';
import { Viewer } from '../../components/viewer/Viewer';
import { ErrorRes, GetRes, jsonFetcher } from '../../lib/api';
import { head, StreamCredentials } from '../../lib/config';
import {
  Metadata,
  toMetadata,
  toMetadataFromDomainEntries,
  toMetadataFromItem,
} from '../../lib/metadata';
import { useModelViews } from '../../lib/model-views';
import { reportError } from '../../lib/report-error';
import { applySceneViewState, selectByHit } from '../../lib/scene-items';
import { useViewer } from '../../lib/viewer';
import {
  CommonProps,
  CookieAttributes,
  EnvironmentWithCustom,
  NextIronRequest,
  serverSidePropsHandler as commonServerSidePropsHandler,
} from '../../lib/with-session';

const ViewerId = 'vertex-viewer-id';

function useSceneViewStates({
  viewId,
}: {
  viewId?: string;
}): SWRResponse<GetRes<SceneViewStateData>, ErrorRes> {
  return useSWR<GetRes<SceneViewStateData>, ErrorRes>(
    viewId ? `/api/scene-view-states?view=${viewId}` : null
  );
}

// UNRESTRICTED metadata: the server-side REST path that IGNORES the property key
// policy. Used solely to populate the "Unrestricted" comparison column so the
// keys stripped by the policy are visible. The policy-aware Web SDK endpoint
// remains the sole source for the RESTRICTED (displayed) metadata.
function useSceneItem({
  itemId,
}: {
  itemId?: string;
}): SWRResponse<SceneItemData, ErrorRes> {
  // Throwing fetcher so an HTTP failure populates `error` (rather than landing an
  // ErrorRes in `data`, which would both mask the failure and crash
  // `toMetadataFromItem`); its state feeds the comparison's baseline warning.
  return useSWR<SceneItemData, ErrorRes>(
    itemId ? `/api/scene-items/${itemId}` : null,
    jsonFetcher
  );
}

export default function SceneViewer({
  clientId,
  networkConfig,
  vertexEnv,
}: CommonProps): JSX.Element {
  const router = useRouter();
  const viewerState = useViewer();
  const [credentials, setCredentials] = React.useState<StreamCredentials | undefined>();
  const [streamKeyError, setStreamKeyError] = React.useState<string>();
  const requestedStreamKeyForScene = React.useRef<string>();
  const [selectedItemId, setSelectedItemId] = React.useState<string | undefined>();
  const [selectedIdentifiers, setSelectedIdentifiers] = React.useState<HitIdentifiers>();
  const [openedLeftPanel, setOpenedLeftPanel] = React.useState<string>();
  const [openedRightPanel, setOpenedRightPanel] = React.useState<string>();
  const [metadata, setMetadata] = React.useState<Metadata | undefined>();
  // Raw render-frame metadata from the raycaster hit (Stream comparison column).
  // Captured on left-click; cleared on tree-select, policy switch, and when the
  // selection is cleared, since it is only meaningful for a viewer-clicked item.
  const [streamMetadata, setStreamMetadata] = React.useState<Metadata | undefined>();
  const [metadataStatus, setMetadataStatus] = React.useState<MetadataStatus>('ready');
  const [metadataError, setMetadataError] = React.useState<string>();
  const [metadataDiagnostic, setMetadataDiagnostic] = React.useState<string>();
  const [viewId, setViewId] = React.useState<string | undefined>();
  const [policyId, setPolicyId] = React.useState<string | undefined>();
  const [switchingPolicy, setSwitchingPolicy] = React.useState(false);
  // Non-fatal error for a failed in-viewer policy switch. Unlike streamKeyError
  // (which replaces the whole page), this keeps the working viewer mounted.
  const [policySwitchError, setPolicySwitchError] = React.useState<string>();
  const { data, mutate } = useSceneViewStates({ viewId });
  // Unrestricted metadata for the selected item, fetched through the policy-
  // ignoring REST path purely to feed the comparison's "Unrestricted" column.
  const selectedItem = useSceneItem({ itemId: selectedItemId });
  const unrestrictedMetadata = React.useMemo(
    () => (selectedItem.data ? toMetadataFromItem(selectedItem.data) : undefined),
    [selectedItem.data]
  );
  // Surface a failed unrestricted-baseline fetch so a missing baseline is not
  // silently read as "no differences" in the comparison.
  const unrestrictedError = selectedItemId != null && selectedItem.error != null;
  const modelViews = useModelViews({
    itemId: selectedItemId,
    viewerState,
  });

  // Prefer credentials in URL to enable easy scene sharing. Create a stream key only
  // after this page has mounted so route prefetching remains read-only.
  React.useEffect(() => {
    if (!router.isReady) return;

    const cId = head(router.query.clientId) ?? clientId;
    const sk = head(router.query.streamKey);
    const ve = (head(router.query.vertexEnv) as Environment) ?? vertexEnv;
    const sceneId = head(router.query.sceneId);
    const pId = head(router.query.policyId);

    setPolicyId(pId);

    if (cId && sk && ve) {
      setCredentials({ clientId: cId, streamKey: sk, vertexEnv: ve });
      return;
    }
    if (!cId || !sceneId || requestedStreamKeyForScene.current === sceneId) {
      return;
    }

    requestedStreamKeyForScene.current = sceneId;
    setStreamKeyError(undefined);
    void createStreamKey(sceneId, pId)
      .then((streamKey) =>
        router.replace(
          encodeCreds({
            clientId: cId,
            sceneId,
            streamKey,
            vertexEnv: ve,
            policyId: pId,
          }),
          undefined,
          { shallow: true }
        )
      )
      .catch(() => setStreamKeyError('Unable to create a stream key for this scene.'));
  }, [clientId, router, vertexEnv]);

  async function handleSelect(
    detail: TapEventDetails,
    hit?: vertexvis.protobuf.stream.IHit
  ): Promise<void> {
    if (detail.buttons !== 2) {
      setSelectedItemId(hit?.itemId?.hex ?? undefined);
      // Capture the structural identifiers the raycaster hit carries so the
      // synthetic identifier keys (part id/revision, supplied ids) reappear
      // alongside the policy-aware metadata, matching the prior server view.
      setSelectedIdentifiers(hit ? toHitIdentifiers(hit) : undefined);
      // Capture the raw stream metadata delivered inline with the hit so the
      // Stream comparison column reflects what the render frame carried.
      setStreamMetadata(hit ? toMetadata({ hit }) : undefined);
      await selectByHit({ hit, viewer: viewerState.ref.current });
    }
  }

  function handleTreeItemSelected(itemId: string): void {
    setSelectedItemId(itemId);
    setSelectedIdentifiers(undefined);
    // Tree selection has no render-frame hit, so there is no stream sample.
    setStreamMetadata(undefined);
  }

  function handleViewStateSelected(id: string): void {
    applySceneViewState({ id, viewer: viewerState.ref.current }).catch(
      reportError('Failed to apply the scene view state')
    );
  }

  async function handleSceneReady(): Promise<void> {
    const scene = await viewerState.ref.current?.scene();
    if (scene) setViewId(scene.sceneViewId);
  }

  // Switch the applied property key policy while viewing the scene. This
  // recreates the stream key with the new policy, reconnects the viewer, and
  // lets the metadata effect reload the currently-selected item under the new
  // policy once the new scene view is ready.
  async function handlePolicyChange(newPolicyId?: string): Promise<void> {
    if (newPolicyId === policyId) return;

    const sceneId = head(router.query.sceneId);
    const cId = credentials?.clientId ?? clientId;
    const ve = credentials?.vertexEnv ?? vertexEnv;
    if (!sceneId || !cId || !ve) return;

    // Remember the current view so a failed switch can restore the still-working
    // viewer instead of tearing it down.
    const previousViewId = viewId;

    setSwitchingPolicy(true);
    setPolicySwitchError(undefined);
    // Show loading (not stale/empty) in the metadata panel until the new scene
    // view is ready and the retained item's metadata is refetched.
    setViewId(undefined);
    // The captured stream sample is from the pre-switch stream, so drop it; a
    // fresh sample only arrives when the user re-clicks after reconnecting.
    setStreamMetadata(undefined);
    if (selectedItemId != null) setMetadataStatus('loading');

    try {
      const { credentials: nextCredentials, url } = await createPolicySwitch({
        sceneId,
        clientId: cId,
        vertexEnv: ve,
        policyId: newPolicyId,
      });
      // Prevent the mount effect from recreating a key for this scene.
      requestedStreamKeyForScene.current = sceneId;
      setPolicyId(newPolicyId);
      setCredentials(nextCredentials);
      // Retain selectedItemId + selectedIdentifiers so the same item's metadata
      // auto-refetches under the new policy after the viewer reconnects.
      await router.replace(url, undefined, { shallow: true });
    } catch {
      // Keep the existing viewer usable: restore the prior scene view (which
      // re-runs the metadata effect for the retained item) and surface a
      // non-fatal error instead of replacing the page with a fatal alert.
      setViewId(previousViewId);
      setPolicySwitchError(
        'Unable to switch the property key policy. The previous policy is still active.'
      );
    } finally {
      setSwitchingPolicy(false);
    }
  }

  // Load metadata through the policy-aware Web SDK endpoint. With no policy the
  // endpoint returns the complete unfiltered set, so bare viewing is preserved.
  React.useEffect(() => {
    if (selectedItemId == null || viewId == null) {
      // With an item still selected but no scene view yet (e.g. mid policy
      // switch, before the new scene view is ready), keep the panel in a loading
      // state rather than clearing to stale/empty data — the retained item
      // refetches once the new viewId is set.
      if (selectedItemId != null) {
        setMetadataStatus('loading');
        return;
      }
      setMetadata(undefined);
      setMetadataStatus('ready');
      setMetadataError(undefined);
      setMetadataDiagnostic(undefined);
      return;
    }

    const controller = viewerState.ref.current?.sceneItems;
    if (controller == null) return;

    const cancelled = { current: false };
    setMetadataStatus('loading');
    setMetadataError(undefined);
    setMetadataDiagnostic(undefined);

    void (async () => {
      try {
        const { metadata: md, entryCount } = await loadItemMetadata({
          controller,
          itemId: selectedItemId,
          viewId,
          identifiers: selectedIdentifiers,
        });
        if (cancelled.current) return;

        setMetadata(md);
        setMetadataStatus('ready');
        // Bonus diagnostic (non-blocking): base "no metadata returned" on the
        // count of real (non-synthetic) entries the endpoint returned, since
        // identifier keys are always merged in and would mask an empty result.
        setMetadataDiagnostic(diagnosePolicy({ policyId, entryCount }));
      } catch {
        if (cancelled.current) return;
        setMetadata(undefined);
        setMetadataStatus('error');
        setMetadataError('Unable to load metadata for this item.');
      }
    })();

    return () => {
      cancelled.current = true;
    };
  }, [selectedItemId, viewId, policyId, selectedIdentifiers, viewerState.ref]);

  const featureLines = { width: 0.5, color: '#444444' };

  if (streamKeyError) {
    return <p role="alert">{streamKeyError}</p>;
  }

  return router.isReady && credentials ? (
    <>
      <Layout
        header={
          <Header
            actions={
              <PolicySelect
                policyId={policyId}
                onChange={(newPolicyId) => {
                  handlePolicyChange(newPolicyId).catch(
                    reportError('Failed to switch the property key policy')
                  );
                }}
                disabled={switchingPolicy}
              />
            }
          />
        }
        leftSidebar={
          <LeftSidebar active={openedLeftPanel} onSelectSidebar={setOpenedLeftPanel} />
        }
        leftDrawer={
          <LeftDrawer
            active={openedLeftPanel}
            configEnv={credentials.vertexEnv}
            networkConfig={networkConfig}
            viewerId={ViewerId}
            selectedItemId={selectedItemId}
            viewerState={viewerState}
            onItemSelected={handleTreeItemSelected}
          />
        }
        leftDrawerOpen={openedLeftPanel != null}
        main={
          viewerState.isReady && (
            <Viewer
              key={credentials.streamKey}
              credentials={credentials}
              onSelect={handleSelect}
              viewerState={viewerState}
              viewerId={ViewerId}
              onViewStateCreated={() => {
                mutate().catch(reportError('Failed to refresh scene view states'));
              }}
              networkConfig={networkConfig}
              featureLines={featureLines}
              rotateAroundTapPoint={true}
              onSceneReady={() => {
                handleSceneReady().catch(reportError('Failed to prepare the scene view'));
              }}
              onViewReset={() => {
                setSelectedItemId(undefined);
                setStreamMetadata(undefined);
                modelViews.actions
                  .unloadModelView()
                  .catch(reportError('Failed to unload the model view'));
              }}
            />
          )
        }
        rightSidebar={
          <RightSidebar active={openedRightPanel} onSelectSidebar={setOpenedRightPanel} />
        }
        rightDrawer={
          <RightDrawer
            active={openedRightPanel}
            metadata={metadata}
            unrestrictedMetadata={unrestrictedMetadata}
            unrestrictedError={unrestrictedError}
            streamMetadata={streamMetadata}
            metadataStatus={metadataStatus}
            metadataError={metadataError}
            metadataDiagnostic={metadataDiagnostic}
            modelViews={modelViews}
            sceneViewStates={data?.data}
            onViewStateSelected={handleViewStateSelected}
          />
        }
        rightDrawerOpen={openedRightPanel != null}
      />
      <Snackbar
        open={policySwitchError != null}
        autoHideDuration={6000}
        onClose={() => setPolicySwitchError(undefined)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="error"
          onClose={() => setPolicySwitchError(undefined)}
          sx={{ width: '100%' }}
        >
          {policySwitchError}
        </Alert>
      </Snackbar>
    </>
  ) : (
    <></>
  );
}

type SceneItemController = NonNullable<HTMLVertexViewerElement['sceneItems']>;

// Structural identifiers the raycaster hit carries client-side. These are not
// policy-restricted metadata, so they are surfaced as synthetic keys for parity.
export interface HitIdentifiers {
  readonly suppliedId?: string;
  readonly partId?: string;
  readonly partRevisionId?: string;
  readonly partRevisionSuppliedId?: string;
}

export function toHitIdentifiers(hit: vertexvis.protobuf.stream.IHit): HitIdentifiers {
  return {
    suppliedId: hit.itemSuppliedId?.value ?? undefined,
    partId: hit.partId?.hex ?? undefined,
    partRevisionId: hit.partRevisionId?.hex ?? undefined,
    partRevisionSuppliedId: hit.suppliedPartRevisionId?.value ?? undefined,
  };
}

// Page through every metadata entry for the item via the policy-aware Web SDK.
// Cursor pagination is inherently sequential (each request needs the prior
// page's cursor), so the awaits run in series while entries accumulate into a
// single array — avoiding the repeated copying and unbounded call stack a
// spread-based recursion would incur. A `const` holder keeps the paging cursor
// mutable without a `let` (banned in production .tsx).
async function fetchAllItemMetadataEntries(
  controller: SceneItemController,
  itemId: string
): Promise<DomainPropertyEntry[]> {
  const entries: DomainPropertyEntry[] = [];
  const paging: { cursor?: string; done: boolean } = { done: false };
  while (!paging.done) {
    const res: SceneItemMetadataResponse =
      // eslint-disable-next-line no-await-in-loop
      await controller.listSceneItemMetadata(itemId, {
        size: 100,
        cursor: paging.cursor,
      });
    entries.push(...res.entries);
    paging.cursor = res.paging?.next ?? undefined;
    paging.done = paging.cursor == null;
  }
  return entries;
}

// Fetch metadata for the selected item through the policy-aware Web SDK,
// paginating over all pages, and merging in the synthetic identifier keys.
// `entryCount` is the number of real (non-synthetic) entries returned, used
// by the non-blocking policy diagnostic.
export async function loadItemMetadata({
  controller,
  itemId,
  viewId,
  identifiers,
}: {
  controller: SceneItemController;
  itemId: string;
  viewId: string;
  identifiers?: HitIdentifiers;
}): Promise<{ metadata: Metadata; entryCount: number }> {
  const entries = await fetchAllItemMetadataEntries(controller, itemId);

  const item = await controller
    .getSceneViewItem(itemId, viewId, {})
    .catch(() => undefined);

  const metadata = toMetadataFromDomainEntries(entries, {
    id: item?.id ?? itemId,
    suppliedId: item?.suppliedId ?? identifiers?.suppliedId,
    name: item?.name ?? undefined,
    partId: identifiers?.partId,
    partRevisionId: identifiers?.partRevisionId,
    partRevisionSuppliedId: identifiers?.partRevisionSuppliedId,
  });

  return { metadata, entryCount: entries.length };
}

export async function createStreamKey(
  sceneId: string,
  policyId?: string
): Promise<string> {
  const response = await fetch('/api/stream-keys', {
    body: JSON.stringify({
      id: sceneId,
      ...(policyId ? { propertyKeyPolicyId: policyId } : {}),
    }),
    method: 'POST',
  });
  if (!response.ok) throw new Error('Stream-key creation failed.');

  const { key } = (await response.json()) as { key?: string };
  if (!key) throw new Error('Created scene stream key was empty.');
  return key;
}

// Core of the in-viewer policy switch: recreate the stream key under the new
// policy and derive the credentials + shareable URL the viewer reconnects with.
// Exported so the switch behavior is directly testable without driving the full
// page (which mounts the VertexViewer web component).
export async function createPolicySwitch({
  sceneId,
  clientId,
  vertexEnv,
  policyId,
}: {
  sceneId: string;
  clientId: string;
  vertexEnv: EnvironmentWithCustom;
  policyId?: string;
}): Promise<{
  streamKey: string;
  credentials: StreamCredentials;
  url: string;
}> {
  const streamKey = await createStreamKey(sceneId, policyId);
  return {
    streamKey,
    credentials: { clientId, streamKey, vertexEnv },
    url: encodeCreds({ clientId, sceneId, streamKey, vertexEnv, policyId }),
  };
}

// Bonus (non-blocking): a subtle diagnostic when the returned metadata looks
// suspicious for the active policy. This never blocks or breaks the normal flow.
// TODO(PLAT-8995): compare returned keys against the policy's declared entries
// (`listPropertyKeyPolicyEntries`) once an entries endpoint is exposed; for now
// we only flag the case where a policy is active but no metadata came back.
// Based on `entryCount` (real, non-synthetic entries) — the merged synthetic
// identifier keys are always present, so counting displayed keys would never fire.
export function diagnosePolicy({
  policyId,
  entryCount,
}: {
  policyId?: string;
  entryCount: number;
}): string | undefined {
  if (!policyId) return undefined;
  return entryCount === 0
    ? 'Policy applied, but no metadata was returned for this item.'
    : undefined;
}

export function encodeCreds({
  clientId,
  streamKey,
  vertexEnv,
  sceneId,
  policyId,
}: {
  clientId: string;
  streamKey: string;
  vertexEnv: EnvironmentWithCustom;
  sceneId?: string;
  policyId?: string;
}): string {
  const path = `/scene-viewer/${encodeURIComponent(sceneId ?? 'unknown')}`;
  const cId = `clientId=${encodeURIComponent(clientId)}`;
  const sk = `streamKey=${encodeURIComponent(streamKey)}`;
  const ve = `vertexEnv=${encodeURIComponent(vertexEnv)}`;
  const pId = policyId ? `&policyId=${encodeURIComponent(policyId)}` : '';
  return `${path}/?${cId}&${sk}&${ve}${pId}`;
}

export function serverSidePropsHandler({
  query,
  req,
}: Pick<GetServerSidePropsContext, 'query'> & {
  readonly req: NextIronRequest;
}): GetServerSidePropsResult<CommonProps> {
  const authResult = commonServerSidePropsHandler({ req });
  if (!('props' in authResult)) return authResult;

  const sceneId = head(query.sceneId);
  if (sceneId == null) return { notFound: true };

  return authResult;
}

export const getServerSideProps = withIronSession(
  serverSidePropsHandler,
  CookieAttributes
);
