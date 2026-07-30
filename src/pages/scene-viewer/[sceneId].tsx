import { SceneItemData, SceneViewStateData } from "@vertexvis/api-client-node";
import { vertexvis } from "@vertexvis/frame-streaming-protos";
import { Environment, TapEventDetails } from "@vertexvis/viewer";
import { GetServerSidePropsContext, GetServerSidePropsResult } from "next";
import { useRouter } from "next/router";
import { withIronSession } from "next-iron-session";
import React from "react";
import useSWR from "swr";

import { Header } from "../../components/shared/Header";
import { Layout } from "../../components/viewer/Layout";
import { LeftDrawer } from "../../components/viewer/LeftDrawer";
import { LeftSidebar } from "../../components/viewer/LeftSidebar";
import { PolicySelect } from "../../components/viewer/PolicySelect";
import { RightDrawer } from "../../components/viewer/RightDrawer";
import { RightSidebar } from "../../components/viewer/RightSidebar";
import { Viewer } from "../../components/viewer/Viewer";
import { ErrorRes, GetRes } from "../../lib/api";
import { head, StreamCredentials } from "../../lib/config";
import { Metadata, toMetadataFromItem } from "../../lib/metadata";
import { useModelViews } from "../../lib/model-views";
import { applySceneViewState, selectByHit } from "../../lib/scene-items";
import { useViewer } from "../../lib/viewer";
import {
  CommonProps,
  CookieAttributes,
  EnvironmentWithCustom,
  NextIronRequest,
  serverSidePropsHandler as commonServerSidePropsHandler,
} from "../../lib/with-session";

const ViewerId = "vertex-viewer-id";

function useSceneViewStates({ viewId }: { viewId?: string }) {
  return useSWR<GetRes<SceneViewStateData>, ErrorRes>(
    viewId ? `/api/scene-view-states?view=${viewId}` : null
  );
}

function useSceneItem({ itemId }: { itemId?: string }) {
  return useSWR<SceneItemData, ErrorRes>(
    itemId ? `/api/scene-items/${itemId}` : null
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
  const [openedLeftPanel, setOpenedLeftPanel] = React.useState<string>();
  const [openedRightPanel, setOpenedRightPanel] = React.useState<string>();
  const [metadata, setMetadata] = React.useState<Metadata | undefined>();
  const [viewId, setViewId] = React.useState<string | undefined>();
  const [policyId, setPolicyId] = React.useState<string | undefined>();
  const [switchingPolicy, setSwitchingPolicy] = React.useState(false);
  const { data, mutate } = useSceneViewStates({ viewId });
  const selectedItem = useSceneItem({ itemId: selectedItemId });
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
    console.debug({
      hitNormal: hit?.hitNormal,
      hitPoint: hit?.hitPoint,
      sceneItemId: hit?.itemId?.hex,
      sceneItemSuppliedId: hit?.itemSuppliedId?.value,
    });

    if (detail.buttons !== 2) {
      setSelectedItemId(hit?.itemId?.hex ?? undefined);
      await selectByHit({ hit, viewer: viewerState.ref.current });
    }
  }

  function handleTreeItemSelected(itemId: string) {
    setSelectedItemId(itemId);
  }

  function handleViewStateSelected(id: string) {
    applySceneViewState({ id, viewer: viewerState.ref.current });
  }

  async function handlePolicyChange(newPolicyId?: string) {
    if (newPolicyId === policyId) return;

    const sceneId = head(router.query.sceneId);
    const cId = credentials?.clientId ?? clientId;
    const ve = credentials?.vertexEnv ?? vertexEnv;
    if (!sceneId || !cId || !ve) return;

    setSwitchingPolicy(true);
    setStreamKeyError(undefined);
    try {
      const { credentials: nextCredentials, url } = await createPolicySwitch({
        sceneId,
        clientId: cId,
        vertexEnv: ve,
        policyId: newPolicyId,
      });
      requestedStreamKeyForScene.current = sceneId;
      setPolicyId(newPolicyId);
      setCredentials(nextCredentials);
      await router.replace(url, undefined, { shallow: true });
    } catch {
      setStreamKeyError("Unable to create a stream key for this scene.");
    } finally {
      setSwitchingPolicy(false);
    }
  }

  React.useEffect(() => {
    if (selectedItem.data) {
      setMetadata(toMetadataFromItem(selectedItem.data));
    }
  }, [selectedItem.data]);

  const featureLines = { width: 0.5, color: "#444444" };

  if (streamKeyError) {
    return <p role="alert">{streamKeyError}</p>;
  }

  return router.isReady && credentials ? (
    <Layout
      header={
        <Header
          actions={
            <PolicySelect
              policyId={policyId}
              onChange={handlePolicyChange}
              disabled={switchingPolicy}
              sx={{ minWidth: "14rem" }}
            />
          }
        />
      }
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
            key={credentials.streamKey}
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
