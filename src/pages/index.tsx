import { Environment } from "@vertexvis/viewer";
import React from "react";

import { SceneDrawer } from "../components/scene/SceneDrawer";
import { SceneTable } from "../components/scene/SceneTable";
import { Layout } from "../components/shared/Layout";
import { Config } from "../lib/config";
import { Scene } from "../lib/scenes";

interface Props {
  readonly clientId?: string;
  readonly vertexEnv: Environment;
}

export function getServerSideProps(): Promise<{ props: Props }> {
  return Promise.resolve({ props: Config });
}

export default function Home({ clientId, vertexEnv }: Props): JSX.Element {
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
