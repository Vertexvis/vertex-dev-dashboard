import { useRouter } from "next/router";
import React from "react";

import { SceneWorkspace } from "../../components/scene/SceneWorkspace";
import { Layout } from "../../components/shared/Layout";
import { CommonProps, defaultServerSideProps } from "../../lib/with-session";

export default function SceneWorkspacePage({
  clientId,
  networkConfig,
  vertexEnv,
}: CommonProps): JSX.Element {
  const router = useRouter();
  const sceneId = router.query.sceneId;

  return (
    <Layout
      main={
        typeof sceneId === "string" ? (
          <SceneWorkspace
            clientId={clientId}
            networkConfig={networkConfig}
            sceneId={sceneId}
            vertexEnv={vertexEnv}
          />
        ) : (
          <></>
        )
      }
    />
  );
}

export const getServerSideProps = defaultServerSideProps;
