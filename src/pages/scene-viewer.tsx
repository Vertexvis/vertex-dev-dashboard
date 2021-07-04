import { vertexvis } from "@vertexvis/frame-streaming-protos";
import { Environment } from "@vertexvis/viewer";
import { useRouter } from "next/router";
import React from "react";

import { Header } from "../components/shared/Header";
import { Layout } from "../components/viewer/Layout";
import { LeftDrawer } from "../components/viewer/LeftDrawer";
import { RightDrawer } from "../components/viewer/RightDrawer";
import { Viewer } from "../components/viewer/Viewer";
import { head, StreamCredentials } from "../lib/config";
import { Metadata, toMetadata } from "../lib/metadata";
import { selectByHit } from "../lib/scene-items";
import { useViewer } from "../lib/viewer";

const ViewerId = "vertex-viewer-id";

export default function SceneViewer(): JSX.Element {
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

  // On credentials changes, update URL.
  React.useEffect(() => {
    if (credentials) router.push(encodeCreds(credentials));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credentials]);

  async function handleSelect(hit?: vertexvis.protobuf.stream.IHit) {
    console.debug({
      hitNormal: hit?.hitNormal,
      hitPoint: hit?.hitPoint,
      partName: hit?.metadata?.partName,
      sceneItemId: hit?.itemId?.hex,
      sceneItemSuppliedId: hit?.itemSuppliedId?.value,
    });
    setMetadata(toMetadata({ hit }));
    setSelectedItemId(hit?.itemId?.hex ? hit?.itemId?.hex : undefined);
    await selectByHit({ hit, viewer: viewer.ref.current });
  }

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
          onClose={() => setDrawerOpen(false)}
          open={drawerOpen}
          viewerId={ViewerId}
          selectedItemdId={selectedItemId}
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
          />
        )
      }
      rightDrawer={<RightDrawer metadata={metadata} />}
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
}: {
  clientId: string;
  streamKey: string;
  vertexEnv: Environment;
}): string {
  const path = "scene-viewer";
  const cId = `clientId=${encodeURIComponent(clientId)}`;
  const sk = `streamKey=${encodeURIComponent(streamKey)}`;
  const ve = `vertexEnv=${encodeURIComponent(vertexEnv)}`;
  return `${path}/?${cId}&${sk}&${ve}`;
}
