import { SceneViewStateData } from "@vertexvis/api-client-node";
import { vertexvis } from "@vertexvis/frame-streaming-protos";
import {
  DomainPropertyEntry,
  Environment,
  SceneItemMetadataResponse,
  TapEventDetails,
} from "@vertexvis/viewer";
import { GetServerSidePropsContext, GetServerSidePropsResult } from "next";
import { useRouter } from "next/router";
import { withIronSession } from "next-iron-session";
import React from "react";
import useSWR from "swr";

import { Header } from "../../components/shared/Header";
import { Layout } from "../../components/viewer/Layout";
import { LeftDrawer } from "../../components/viewer/LeftDrawer";
import { LeftSidebar } from "../../components/viewer/LeftSidebar";
import { MetadataStatus } from "../../components/viewer/MetadataProperties";
import { PolicyChip } from "../../components/viewer/PolicyChip";
import { RightDrawer } from "../../components/viewer/RightDrawer";
import { RightSidebar } from "../../components/viewer/RightSidebar";
import { Viewer } from "../../components/viewer/Viewer";
import { ErrorRes, GetRes } from "../../lib/api";
import { head, StreamCredentials } from "../../lib/config";
import { Metadata, toMetadataFromDomainEntries } from "../../lib/metadata";
import { useModelViews } from "../../lib/model-views";
import { applySceneViewState, selectByHit } from "../../lib/scene-items";
import { useViewer } from "../../lib/viewer";
import {
  CommonProps,
  CookieAttributes,
  NextIronRequest,
  serverSidePropsHandler as commonServerSidePropsHandler,
} from "../../lib/with-session";

const ViewerId = "vertex-viewer-id";

function useSceneViewStates({ viewId }: { viewId?: string }) {
  return useSWR<GetRes<SceneViewStateData>, ErrorRes>(
    viewId ? `/api/scene-view-states?view=${viewId}` : null
  );
}

export default function SceneViewer({
  clientId,
  networkConfig,
  vertexEnv,
}: CommonProps): JSX.Element {
  const router = useRouter();
  const viewerState = useViewer();
  const [credentials, setCredentials] = React.useState<
    StreamCredentials | undefined
  >();
  const [streamKeyError, setStreamKeyError] = React.useState<string>();
  const requestedStreamKeyForScene = React.useRef<string>();
  const [selectedItemId, setSelectedItemId] = React.useState<
    string | undefined
  >();
  const [selectedIdentifiers, setSelectedIdentifiers] =
    React.useState<HitIdentifiers>();
  const [openedLeftPanel, setOpenedLeftPanel] = React.useState<string>();
  const [openedRightPanel, setOpenedRightPanel] = React.useState<string>();
  const [metadata, setMetadata] = React.useState<Metadata | undefined>();
  const [metadataStatus, setMetadataStatus] =
    React.useState<MetadataStatus>("ready");
  const [metadataError, setMetadataError] = React.useState<string>();
  const [metadataDiagnostic, setMetadataDiagnostic] = React.useState<string>();
  const [viewId, setViewId] = React.useState<string | undefined>();
  const [policyId, setPolicyId] = React.useState<string | undefined>();
  const { data, mutate } = useSceneViewStates({ viewId });
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
      .catch(() =>
        setStreamKeyError("Unable to create a stream key for this scene.")
      );
  }, [clientId, router, vertexEnv]);

  async function handleSelect(
    detail: TapEventDetails,
    hit?: vertexvis.protobuf.stream.IHit
  ) {
    if (detail.buttons !== 2) {
      setSelectedItemId(hit?.itemId?.hex ?? undefined);
      // Capture the structural identifiers the raycaster hit carries so the
      // synthetic identifier keys (part id/revision, supplied ids) reappear
      // alongside the policy-aware metadata, matching the prior server view.
      setSelectedIdentifiers(hit ? toHitIdentifiers(hit) : undefined);
      await selectByHit({ hit, viewer: viewerState.ref.current });
    }
  }

  function handleTreeItemSelected(itemId: string) {
    setSelectedItemId(itemId);
    setSelectedIdentifiers(undefined);
  }

  function handleViewStateSelected(id: string) {
    applySceneViewState({ id, viewer: viewerState.ref.current });
  }

  // Load metadata through the policy-aware Web SDK endpoint. With no policy the
  // endpoint returns the complete unfiltered set, so bare viewing is preserved.
  React.useEffect(() => {
    if (selectedItemId == null || viewId == null) {
      setMetadata(undefined);
      setMetadataStatus("ready");
      setMetadataError(undefined);
      setMetadataDiagnostic(undefined);
      return;
    }

    const controller = viewerState.ref.current?.sceneItems;
    if (controller == null) return;

    let cancelled = false;
    setMetadataStatus("loading");
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
        if (cancelled) return;

        setMetadata(md);
        setMetadataStatus("ready");
        // Bonus diagnostic (non-blocking): base "no metadata returned" on the
        // count of real (non-synthetic) entries the endpoint returned, since
        // identifier keys are always merged in and would mask an empty result.
        setMetadataDiagnostic(diagnosePolicy({ policyId, entryCount }));
      } catch {
        if (cancelled) return;
        setMetadata(undefined);
        setMetadataStatus("error");
        setMetadataError("Unable to load metadata for this item.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedItemId, viewId, policyId, selectedIdentifiers, viewerState.ref]);

  const featureLines = { width: 0.5, color: "#444444" };

  if (streamKeyError) {
    return <p role="alert">{streamKeyError}</p>;
  }

  return router.isReady && credentials ? (
    <Layout
      header={<Header actions={<PolicyChip policyId={policyId} />} />}
      leftSidebar={
        <LeftSidebar
          active={openedLeftPanel}
          onSelectSidebar={setOpenedLeftPanel}
        />
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
            credentials={credentials}
            onSelect={handleSelect}
            viewerState={viewerState}
            viewerId={ViewerId}
            onViewStateCreated={mutate}
            networkConfig={networkConfig}
            featureLines={featureLines}
            rotateAroundTapPoint={true}
            onSceneReady={async () => {
              const scene = await viewerState.ref.current?.scene();
              if (scene) setViewId(scene.sceneViewId);
            }}
            onViewReset={() => {
              setSelectedItemId(undefined);
              modelViews.actions.unloadModelView();
            }}
          />
        )
      }
      rightSidebar={
        <RightSidebar
          active={openedRightPanel}
          onSelectSidebar={setOpenedRightPanel}
        />
      }
      rightDrawer={
        <RightDrawer
          active={openedRightPanel}
          metadata={metadata}
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
  ) : (
    <></>
  );
}

type SceneItemController = NonNullable<HTMLVertexViewerElement["sceneItems"]>;

// Structural identifiers the raycaster hit carries client-side. These are not
// policy-restricted metadata, so they are surfaced as synthetic keys for parity.
export interface HitIdentifiers {
  readonly suppliedId?: string;
  readonly partId?: string;
  readonly partRevisionId?: string;
  readonly partRevisionSuppliedId?: string;
}

export function toHitIdentifiers(
  hit: vertexvis.protobuf.stream.IHit
): HitIdentifiers {
  return {
    suppliedId: hit.itemSuppliedId?.value ?? undefined,
    partId: hit.partId?.hex ?? undefined,
    partRevisionId: hit.partRevisionId?.hex ?? undefined,
    partRevisionSuppliedId: hit.suppliedPartRevisionId?.value ?? undefined,
  };
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
  const entries: DomainPropertyEntry[] = [];
  let cursor: string | undefined = undefined;
  do {
    const res: SceneItemMetadataResponse =
      // eslint-disable-next-line no-await-in-loop
      await controller.listSceneItemMetadata(itemId, { size: 100, cursor });
    entries.push(...res.entries);
    cursor = res.paging?.next ?? undefined;
  } while (cursor != null);

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
  const response = await fetch("/api/stream-keys", {
    body: JSON.stringify({
      id: sceneId,
      ...(policyId ? { propertyKeyPolicyId: policyId } : {}),
    }),
    method: "POST",
  });
  if (!response.ok) throw new Error("Stream-key creation failed.");

  const { key } = (await response.json()) as { key?: string };
  if (!key) throw new Error("Created scene stream key was empty.");
  return key;
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
    ? "Policy applied, but no metadata was returned for this item."
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
  vertexEnv: Environment;
  sceneId?: string;
  policyId?: string;
}): string {
  const path = `/scene-viewer/${encodeURIComponent(sceneId ?? "unknown")}`;
  const cId = `clientId=${encodeURIComponent(clientId)}`;
  const sk = `streamKey=${encodeURIComponent(streamKey)}`;
  const ve = `vertexEnv=${encodeURIComponent(vertexEnv)}`;
  const pId = policyId ? `&policyId=${encodeURIComponent(policyId)}` : "";
  return `${path}/?${cId}&${sk}&${ve}${pId}`;
}

export function serverSidePropsHandler({
  query,
  req,
}: Pick<GetServerSidePropsContext, "query"> & {
  readonly req: NextIronRequest;
}): GetServerSidePropsResult<CommonProps> {
  const authResult = commonServerSidePropsHandler({ req });
  if (!("props" in authResult)) return authResult;

  const sceneId = head(query.sceneId);
  if (sceneId == null) return { notFound: true };

  return authResult;
}

export const getServerSideProps = withIronSession(
  serverSidePropsHandler,
  CookieAttributes
);
