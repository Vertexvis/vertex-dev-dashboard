import { Paper, Typography } from "@material-ui/core";
import { Environment } from "@vertexvis/viewer";
import React from "react";

import { DetailsRightDrawer } from "../components/DetailsRightDrawer";
import { Header } from "../components/Header";
import { LeftDrawer } from "../components/LeftDrawer";
import { SceneLayout } from "../components/SceneLayout";
import { SceneTable } from "../components/SceneTable";
import { Config } from "../lib/config";

interface Props {
  readonly clientId?: string;
  readonly clientSecret?: string;
  readonly vertexEnv: Environment;
}

export function getServerSideProps(): Promise<{ props: Props }> {
  return Promise.resolve({ props: Config });
}

export default function Home({ clientId, vertexEnv }: Props): JSX.Element {
  const [open, setOpen] = React.useState(true);

  const handleDrawerClose = () => {
    setOpen(false);
  };

  return (
    <SceneLayout
      header={<Header />}
      leftDrawer={<LeftDrawer />}
      leftDrawerOpen
      main={
        clientId && vertexEnv ? (
          <SceneTable clientId={clientId} vertexEnv={vertexEnv} />
        ) : (
          <Paper sx={{ m: 2 }}>
            <Typography>Account credentials required.</Typography>
          </Paper>
        )
      }
      rightDrawer={
        <DetailsRightDrawer onClose={handleDrawerClose} open={open} />
      }
      rightDrawerOpen={open}
    ></SceneLayout>
  );
}
