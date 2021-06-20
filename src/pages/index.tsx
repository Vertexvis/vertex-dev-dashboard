import { Paper, Typography } from "@material-ui/core";
import { Environment } from "@vertexvis/viewer";
import React from "react";

import { Header } from "../components/Header";
import { Layout } from "../components/Layout";
import { LeftDrawer } from "../components/LeftDrawer";
import { SceneTable } from "../components/SceneTable";
import { AccountCredentials, Config } from "../lib/config";

interface Props {
  readonly clientId?: string;
  readonly clientSecret?: string;
  readonly vertexEnv: Environment;
}

export function getServerSideProps(): Promise<{ props: Props }> {
  return Promise.resolve({ props: Config });
}

export default function Home(props: Props): JSX.Element {
  const [credentials, setCredentials] =
    React.useState<Partial<AccountCredentials>>(props);
  // const credentialsValid =
  //   credentials.clientId && credentials.clientSecret && credentials.vertexEnv;
  // const [dialogOpen, setDialogOpen] = React.useState(!credentialsValid);

  // function handleAccountClick() {
  //   setDialogOpen(true);
  // }

  // function handleConfirm(as: AccountCredentials): void {
  //   setCredentials(as);
  //   handleClose();
  // }

  // function handleClose(): void {
  //   setDialogOpen(false);
  // }

  return (
    <Layout
      header={<Header />}
      leftDrawer={<LeftDrawer />}
      leftDrawerOpen
      main={
        credentials.clientId && credentials.vertexEnv ? (
          <SceneTable
            clientId={credentials.clientId}
            vertexEnv={credentials.vertexEnv}
          />
        ) : (
          <Paper sx={{ m: 2 }}>
            <Typography>Account credentials required.</Typography>
          </Paper>
        )
      }
    >
      {/* {dialogOpen && (
        <AccountDialog
          credentials={credentials}
          onClose={handleClose}
          onConfirm={handleConfirm}
          open={dialogOpen}
        />
      )} */}
    </Layout>
  );
}
