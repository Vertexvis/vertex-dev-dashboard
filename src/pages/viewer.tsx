import { Environment } from "@vertexvis/viewer";
import { useRouter } from "next/router";
import React from "react";

import { Header } from "../components/Header";
import { Layout } from "../components/Layout";
import { LeftDrawer } from "../components/LeftDrawer";
import { encodeCreds } from "../components/OpenScene";
import { Viewer } from "../components/Viewer";
import {
  Config,
  DefaultCredentials,
  head,
  StreamCredentials,
} from "../lib/config";
import { Metadata, toMetadata } from "../lib/metadata";
import { selectByHit as onSelect } from "../lib/scene-items";
import { useViewer } from "../lib/viewer";

interface Props {
  readonly vertexEnv: Environment;
}

export default function Home({ vertexEnv }: Props): JSX.Element {
  const router = useRouter();
  const viewer = useViewer();
  const [credentials, setCredentials] = React.useState<
    StreamCredentials | undefined
  >();
  const [metadata, setMetadata] = React.useState<Metadata | undefined>();

  // Prefer credentials in URL to enable easy scene sharing. If empty, use defaults.
  React.useEffect(() => {
    if (!router.isReady) return;

    setCredentials({
      clientId: head(router.query.clientId) || DefaultCredentials.clientId,
      streamKey: head(router.query.streamKey) || DefaultCredentials.streamKey,
    });
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
      leftDrawer={<LeftDrawer />}
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
    />
  ) : (
    <></>
  );
}

export function getServerSideProps(): Promise<{ props: Props }> {
  return Promise.resolve({ props: { vertexEnv: Config.vertexEnv } });
}
