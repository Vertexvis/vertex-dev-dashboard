import { SceneItemData, SceneViewStateData } from "@vertexvis/api-client-node";
import { vertexvis } from "@vertexvis/frame-streaming-protos";
import { Environment } from "@vertexvis/viewer";
import { useRouter } from "next/router";
import React from "react";
import useSWR from "swr";

import { Header } from "../../components/shared/Header";
import { Layout } from "../../components/viewer/Layout";
import { LeftDrawer } from "../../components/viewer/LeftDrawer";
import { RightDrawer } from "../../components/viewer/RightDrawer";
import { Viewer } from "../../components/viewer/Viewer";
import { ErrorRes, GetRes } from "../../lib/api";
import { head, StreamCredentials } from "../../lib/config";
import { Metadata, toMetadata, toMetadataFromItem } from "../../lib/metadata";
import { applySceneViewState, selectByHit } from "../../lib/scene-items";
import { useViewer } from "../../lib/viewer";
import { CommonProps, defaultServerSideProps } from "../../lib/with-session";

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
  networkConfig,
}: CommonProps): JSX.Element {
  const router = useRouter();
  const viewer = useViewer();
  const [credentials, setCredentials] = React.useState<
    StreamCredentials | undefined
  >();
  const [selectedItemId, setSelectedItemId] = React.useState<
    string | undefined
  >();

  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [metadata, setMetadata] = React.useState<Metadata | undefined>();
  const [viewId, setViewId] = React.useState<string | undefined>();
  const [selectedItemFromTree, setSelectedItemFromTree] = React.useState(false);
  const { data, mutate } = useSceneViewStates({ viewId });
  const selectedItem = useSceneItem({ itemId: selectedItemId });

  // Prefer credentials in URL to enable easy scene sharing. If empty, use defaults.
  React.useEffect(() => {
    if (!router.isReady) return;

    const cId = head(router.query.clientId);
    const sk = head(router.query.streamKey);
    const ve = head(router.query.vertexEnv) as Environment;

    setCredentials(
      cId && sk && ve
        ? { clientId: cId, streamKey: sk, vertexEnv: ve }
        : undefined
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  async function handleSelect(hit?: vertexvis.protobuf.stream.IHit) {
    console.debug({
      hitNormal: hit?.hitNormal,
      hitPoint: hit?.hitPoint,
      sceneItemId: hit?.itemId?.hex,
      sceneItemSuppliedId: hit?.itemSuppliedId?.value,
    });
    setSelectedItemFromTree(false);
    setMetadata(toMetadata({ hit }));
    setSelectedItemId(hit?.itemId?.hex ? hit?.itemId?.hex : undefined);
    await selectByHit({ hit, viewer: viewer.ref.current });
  }

  function handleTreeItemSelected(itemId: string) {
    setSelectedItemFromTree(true);
    setSelectedItemId(itemId);
  }

  function handleViewStateSelected(id: string) {
    applySceneViewState({ id, viewer: viewer.ref.current });
  }

  React.useEffect(() => {
    if (selectedItem.data && selectedItemFromTree) {
      setMetadata(toMetadataFromItem(selectedItem.data));
    }
  }, [selectedItem.data, selectedItemFromTree]);

  const featureLines = { width: 0.5, color: "#444444" };

  return router.isReady && credentials ? (
    <Layout
      header={
        <Header
          onMenuClick={() => setDrawerOpen(!drawerOpen)}
          open={drawerOpen}
        />
      }
      leftDrawer={
        <LeftDrawer
          configEnv={credentials.vertexEnv}
          networkConfig={networkConfig}
          onClose={() => setDrawerOpen(false)}
          open={drawerOpen}
          viewerId={ViewerId}
          selectedItemdId={selectedItemId}
          onItemSelected={handleTreeItemSelected}
        />
      }
      leftDrawerOpen={drawerOpen}
      main={
        viewer.isReady && (
          <Viewer
            credentials={credentials}
            onSelect={handleSelect}
            viewer={viewer.ref}
            viewerId={ViewerId}
            onViewStateCreated={mutate}
            networkConfig={networkConfig}
            featureLines={featureLines}
            rotateAroundTapPoint={true}
            onSceneReady={async () => {
              const scene = await viewer.ref.current?.scene();
              if (scene) setViewId(scene.sceneViewId);
            }}
          />
        )
      }
      rightDrawer={
        <RightDrawer
          metadata={metadata}
          sceneViewStates={data?.data}
          onViewStateSelected={handleViewStateSelected}
        />
      }
      rightDrawerOpen
    />
  ) : (
    <></>
  );
}

export function encodeCreds({
  clientId,
  streamKey,
  vertexEnv,
  sceneId,
}: {
  clientId: string;
  streamKey: string;
  vertexEnv: Environment;
  sceneId?: string;
}): string {
  const path = `scene-viewer/${sceneId ? sceneId : "unknown"}`;
  const cId = `clientId=${encodeURIComponent(clientId)}`;
  const sk = `streamKey=${encodeURIComponent(streamKey)}`;
  const ve = `vertexEnv=${encodeURIComponent(vertexEnv)}`;
  return `${path}/?${cId}&${sk}&${ve}`;
}

export const getServerSideProps = defaultServerSideProps;
