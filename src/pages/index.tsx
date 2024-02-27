import dynamic from "next/dynamic";
import React, { useCallback } from "react";

import { SceneDrawer } from "../components/scene/SceneDrawer";
import { Layout } from "../components/shared/Layout";
import { Scene } from "../lib/scenes";
import { CommonProps, defaultServerSideProps } from "../lib/with-session";

const SceneTable = dynamic(() => import("../components/scene/SceneTable"), {
  ssr: false,
});

export default function Home({
  clientId,
  vertexEnv,
}: CommonProps): JSX.Element {
  const [editing, setEditing] = React.useState<boolean>(false);
  const [scene, setScene] = React.useState<Scene | undefined>();
  const drawerOpen = Boolean(scene);
  const [invalidationCount, setInvalidationCount] = React.useState(0);

  function handleClick(s: Scene) {
    setScene(s);
    setEditing(false);
  }

  function handleEditClick(s: Scene) {
    setScene(s);
    setEditing(true);
  }

  const handleClose = useCallback( () => {
    setScene(undefined);
    setEditing(false);
    setInvalidationCount(invalidationCount + 1);
  },[invalidationCount]) 

  return (
    <Layout
      main={
        <SceneTable
          clientId={clientId}
          onClick={handleClick}
          onEditClick={handleEditClick}
          scene={scene}
          vertexEnv={vertexEnv}
          invalidationCount={invalidationCount}
        />
      }
      rightDrawer={
        <SceneDrawer
          editing={editing}
          onClose={handleClose}
          open={drawerOpen}
          scene={scene}
        />
      }
      rightDrawerOpen={drawerOpen}
    />
  );
}

export const getServerSideProps = defaultServerSideProps;
