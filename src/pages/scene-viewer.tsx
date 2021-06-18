import { Environment } from "@vertexvis/viewer";
import { useRouter } from "next/router";
import React from "react";

import { Header } from "../components/Header";
import { Layout } from "../components/Layout";
import { RightDrawer } from "../components/RightDrawer";
import { Viewer } from "../components/Viewer";
import { Config, head, StreamCredentials } from "../lib/config";
import { Metadata, toMetadata } from "../lib/metadata";
import { selectByHit as onSelect } from "../lib/scene-items";
import { useViewer } from "../lib/viewer";

interface Props {
  readonly clientId: string;
  readonly vertexEnv: Environment;
}

export default function SceneViewer({
  clientId,
  vertexEnv,
}: Props): JSX.Element {
  const router = useRouter();
  const viewer = useViewer();
  const [credentials, setCredentials] = React.useState<
    StreamCredentials | undefined
  >();
  const [metadata, setMetadata] = React.useState<Metadata | undefined>();

  // Prefer credentials in URL to enable easy scene sharing. If empty, use defaults.
  React.useEffect(() => {
    if (!router.isReady) return;

    const sk = head(router.query.streamKey);
    setCredentials(
      sk
        ? { clientId: head(router.query.clientId) ?? clientId, streamKey: sk }
        : undefined
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  // On credentials changes, update URL.
  React.useEffect(() => {
    if (credentials) router.push(encodeCreds(credentials));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credentials]);

  return router.isReady && credentials ? (
    <Layout
      header={<Header />}
      main={
        viewer.isReady && (
          <Viewer
            configEnv={vertexEnv}
            credentials={credentials}
            onSelect={async (hit) => {
              setMetadata(toMetadata({ hit }));
              await onSelect({ hit, viewer: viewer.ref.current });
            }}
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

export function getServerSideProps(): Promise<{ props: Props }> {
  return Promise.resolve({
    props: { clientId: Config.clientId, vertexEnv: Config.vertexEnv },
  });
}

export function encodeCreds({
  clientId,
  streamKey,
}: {
  clientId?: string;
  streamKey: string;
}): string {
  const path = "scene-viewer";
  const cId = clientId ? `clientId=${encodeURIComponent(clientId)}` : undefined;
  const sk = `streamKey=${encodeURIComponent(streamKey)}`;
  return cId ? `${path}/?${cId}&${sk}` : `${path}/?${sk}`;
}
