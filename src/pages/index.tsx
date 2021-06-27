import {
  AppBar as MuiAppBar,
  AppBarProps as MuiAppBarProps,
  Box,
  Button,
  Toolbar,
  Typography,
} from "@material-ui/core";
import { styled } from "@material-ui/core/styles";
import { Environment } from "@vertexvis/viewer";
import { signIn, useSession } from "next-auth/client";
import React from "react";

import { Header } from "../components/Header";
import { LeftDrawer } from "../components/LeftDrawer";
import { RightDrawer } from "../components/RightDrawer";
import { SceneTable } from "../components/SceneTable";
import { Config } from "../lib/config";
import { Scene } from "../lib/scenes";
import { easeOutEntering, sharpLeaving } from "../lib/transitions";

interface Props {
  readonly clientId?: string;
  readonly vertexEnv: Environment;
}

interface AppBarProps extends MuiAppBarProps {
  readonly open?: boolean;
}

export const DrawerWidth = 300;

const AppBar = styled(MuiAppBar, {
  shouldForwardProp: (prop) => prop !== "open",
})<AppBarProps>(({ theme, open }) => {
  const { create } = theme.transitions;
  return {
    transition: create(["margin", "width"], sharpLeaving(theme)),
    zIndex: theme.zIndex.drawer + 1,
    ...(open && {
      marginRight: DrawerWidth,
      transition: create(["margin", "width"], easeOutEntering(theme)),
      width: `calc(100% - ${DrawerWidth}px)`,
    }),
  };
});

const Main = styled("main", { shouldForwardProp: (prop) => prop !== "open" })<{
  open?: boolean;
}>(({ theme, open }) => {
  const { create } = theme.transitions;
  return {
    flexGrow: 1,
    marginRight: -DrawerWidth,
    transition: create("margin", sharpLeaving(theme)),
    ...(open && {
      marginRight: 0,
      transition: create("margin", easeOutEntering(theme)),
    }),
  };
});

export function getServerSideProps(): Promise<{ props: Props }> {
  return Promise.resolve({ props: Config });
}

export default function Home({ clientId, vertexEnv }: Props): JSX.Element {
  const [editing, setEditing] = React.useState<boolean>(false);
  const [scene, setScene] = React.useState<Scene | undefined>();
  const [session, loading] = useSession();
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
    <Box sx={{ display: "flex", height: "100vh" }}>
      <AppBar color="default" open={drawerOpen} position="fixed">
        <Toolbar variant="dense">
          <Header />
        </Toolbar>
      </AppBar>
      {session && <LeftDrawer />}
      <Main open={drawerOpen}>
        <Toolbar variant="dense" />
        {!loading && !session ? (
          <Box sx={{ alignItems: "center", display: "flex", m: 2 }}>
            <Typography sx={{ mr: 2 }}>Sign in required.</Typography>
            <Button onClick={() => signIn()}>Sign in</Button>
          </Box>
        ) : (
          <SceneTable
            clientId={clientId}
            onClick={handleClick}
            onEditClick={handleEditClick}
            scene={scene}
            vertexEnv={vertexEnv}
          />
        )}
      </Main>
      <RightDrawer
        editing={editing}
        onClose={handleClose}
        open={drawerOpen}
        scene={scene}
      />
    </Box>
  );
}
