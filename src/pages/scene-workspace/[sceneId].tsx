import { useRouter } from "next/router";
import React from "react";

import { SceneWorkspace } from "../../components/scene/SceneWorkspace";
import { Layout } from "../../components/shared/Layout";
import { defaultServerSideProps } from "../../lib/with-session";

export default function SceneWorkspacePage(): JSX.Element {
  const router = useRouter();
  const sceneId = router.query.sceneId;

  return (
    <Layout
      main={
        typeof sceneId === "string" ? (
          <SceneWorkspace sceneId={sceneId} />
        ) : (
          <></>
        )
      }
    />
  );
}

export const getServerSideProps = defaultServerSideProps;
