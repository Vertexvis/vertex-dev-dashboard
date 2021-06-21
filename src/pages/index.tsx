import {
  AppBar as MuiAppBar,
  AppBarProps as MuiAppBarProps,
  Box,
  Drawer,
  IconButton,
  Paper,
  Toolbar,
  Typography,
} from "@material-ui/core";
import { styled, Theme } from "@material-ui/core/styles";
import { Close } from "@material-ui/icons";
import { Environment } from "@vertexvis/viewer";
import { signIn, useSession } from "next-auth/client";
import React from "react";

import { Header } from "../components/Header";
import { LeftDrawer } from "../components/LeftDrawer";
import { SceneTable } from "../components/SceneTable";
import { Config } from "../lib/config";

export const DenseToolbarHeight = 48;
const drawerWidth = 240;

interface Transition {
  easing: string;
  duration: number;
}

export function sharpLeaving(theme: Theme): Transition {
  return {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  };
}

export function easeOutEntering(theme: Theme): Transition {
  return {
    easing: theme.transitions.easing.easeOut,
    duration: theme.transitions.duration.enteringScreen,
  };
}

interface AppBarProps extends MuiAppBarProps {
  open?: boolean;
}

const AppBar = styled(MuiAppBar, {
  shouldForwardProp: (prop) => prop !== "open",
})<AppBarProps>(({ theme, open }) => {
  const { create } = theme.transitions;
  return {
    transition: create(["margin", "width"], sharpLeaving(theme)),
    zIndex: theme.zIndex.drawer + 1,
    ...(open && {
      marginRight: drawerWidth,
      transition: create(["margin", "width"], easeOutEntering(theme)),
      width: `calc(100% - ${drawerWidth}px)`,
    }),
  };
});

const Main = styled("main", { shouldForwardProp: (prop) => prop !== "open" })<{
  open?: boolean;
}>(({ theme, open }) => {
  const { create } = theme.transitions;
  return {
    flexGrow: 1,
    marginRight: -drawerWidth,
    transition: create("margin", sharpLeaving(theme)),
    ...(open && {
      marginRight: 0,
      transition: create("margin", easeOutEntering(theme)),
    }),
  };
});

interface Props {
  readonly clientId?: string;
  readonly clientSecret?: string;
  readonly vertexEnv: Environment;
}

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
    <>
      {!loading && !session && (
        <>
          Not signed in <br />
          <button onClick={() => signIn()}>Sign in</button>
        </>
      )}
      {!!session && (
        <Box sx={{ display: "flex", height: "100vh" }}>
          <AppBar color="default" open={drawerOpen} position="fixed">
            <Toolbar variant="dense">
              <Header />
            </Toolbar>
          </AppBar>
          <LeftDrawer />
          <Main open={drawerOpen}>
            <Toolbar variant="dense" />
            {clientId && vertexEnv ? (
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
            sx={{
              width: drawerWidth,
              flexShrink: 0,
              "& .MuiDrawer-paper": { width: drawerWidth },
            }}
            variant="persistent"
            anchor="right"
            open={drawerOpen}
          >
            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
              <IconButton onClick={handleDrawerClose}>
                <Close />
              </IconButton>
            </Box>
            Hey there
          </Drawer>
        </Box>
      )}
    </>
  );
}
