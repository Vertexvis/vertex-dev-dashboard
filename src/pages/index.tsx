import React from "react";

import { SceneDrawer } from "../components/scene/SceneDrawer";
import { SceneTable } from "../components/scene/SceneTable";
import { Layout } from "../components/shared/Layout";
import { Scene } from "../lib/scenes";
import { CommonProps } from "../lib/with-session";

export default function Home({
  clientId,
  vertexEnv,
}: CommonProps): JSX.Element {
  const [editing, setEditing] = React.useState<boolean>(false);
  const [scene, setScene] = React.useState<Scene | undefined>();
  const drawerOpen = Boolean(scene);

  function handleClick(s: Scene) {
    setScene(s);
    setEditing(false);
  }

  function handleEditClick(s: Scene) {
    setScene(s);
    setEditing(true);
  }

  function handleClose() {
    setScene(undefined);
    setEditing(false);
  }

  return (
    <Layout
      main={
        <SceneTable
          clientId={clientId}
          onClick={handleClick}
          onEditClick={handleEditClick}
          scene={scene}
          vertexEnv={vertexEnv}
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
