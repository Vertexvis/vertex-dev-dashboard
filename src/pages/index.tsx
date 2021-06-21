import {
  AppBar as MuiAppBar,
  AppBarProps as MuiAppBarProps,
  Box,
  Button,
  Drawer,
  IconButton,
  Paper,
  Toolbar,
  Typography,
} from "@material-ui/core";
import { styled } from "@material-ui/core/styles";
import { Close } from "@material-ui/icons";
import { Environment } from "@vertexvis/viewer";
import { signIn, useSession } from "next-auth/client";
import React from "react";

import { Header } from "../components/Header";
import { LeftDrawer } from "../components/LeftDrawer";
import { SceneTable } from "../components/SceneTable";
import { Config } from "../lib/config";
import { easeOutEntering, sharpLeaving } from "../lib/transitions";

interface Props {
  readonly clientId?: string;
  readonly clientSecret?: string;
  readonly vertexEnv: Environment;
}

interface AppBarProps extends MuiAppBarProps {
  open?: boolean;
}

const DrawerWidth = 240;

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
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [session, loading] = useSession();

  const handleDrawerOpen = () => {
    setDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
  };

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
        ) : clientId && vertexEnv ? (
          <SceneTable
            clientId={clientId}
            onClick={handleDrawerOpen}
            vertexEnv={vertexEnv}
          />
        ) : (
          <Paper sx={{ m: 2 }}>
            <Typography>Account credentials required.</Typography>
          </Paper>
        )}
      </Main>
      <Drawer
        anchor="right"
        open={drawerOpen}
        sx={{
          flexShrink: 0,
          width: DrawerWidth,
          "& .MuiDrawer-paper": { width: DrawerWidth },
        }}
        variant="persistent"
      >
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <IconButton onClick={handleDrawerClose}>
            <Close />
          </IconButton>
        </Box>
        Hey there
      </Drawer>
    </Box>
  );
}
