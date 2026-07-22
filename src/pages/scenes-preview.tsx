import React from "react";

import { SceneDrawer } from "../components/scene/SceneDrawer";
import { ScenePreviewTable } from "../components/scene/ScenePreviewTable";
import { Layout } from "../components/shared/Layout";
import { Scene } from "../lib/scenes";
import { defaultServerSideProps } from "../lib/with-session";

export default function ScenesPreviewPage(): JSX.Element {
  const [scene, setScene] = React.useState<Scene>();
  const drawerOpen = scene != null;

  return (
    <Layout
      main={<ScenePreviewTable onClick={setScene} scene={scene} />}
      rightDrawer={
        <SceneDrawer
          editing={false}
          onClose={() => setScene(undefined)}
          open={drawerOpen}
          scene={scene}
        />
      }
      rightDrawerOpen={drawerOpen}
    />
  );
}

export const getServerSideProps = defaultServerSideProps;
