import { vertexvis } from "@vertexvis/frame-streaming-protos";
import { Environment } from "@vertexvis/viewer";
import { useRouter } from "next/router";
import React from "react";

import { Header } from "../components/Header";
import { Layout } from "../components/Layout";
import { RightDrawer } from "../components/RightDrawer";
import { Viewer } from "../components/Viewer";
import { head, StreamCredentials } from "../lib/config";
import { Metadata, toMetadata } from "../lib/metadata";
import { selectByHit } from "../lib/scene-items";
import { useViewer } from "../lib/viewer";

export default function SceneViewer(): JSX.Element {
  const router = useRouter();
  const viewer = useViewer();
  const [credentials, setCredentials] = React.useState<
    StreamCredentials | undefined
  >();
  const [metadata, setMetadata] = React.useState<Metadata | undefined>();

  // Prefer credentials in URL to enable easy scene sharing. If empty, use defaults.
  React.useEffect(() => {
    if (!router.isReady) return;

    const cId = head(router.query.clientId);
    const sk = head(router.query.streamKey);
    const ve = head(router.query.vertexEnv);
    setCredentials(
      cId && sk && ve
        ? { clientId: cId, streamKey: sk, vertexEnv: ve as Environment }
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
    setMetadata(toMetadata({ hit }));
    await selectByHit({ hit, viewer: viewer.ref.current });
  }

  return router.isReady && credentials ? (
    <Layout
      header={<Header />}
      main={
        viewer.isReady && (
          <Viewer
            credentials={credentials}
            onSelect={handleSelect}
            viewer={viewer.ref}
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
