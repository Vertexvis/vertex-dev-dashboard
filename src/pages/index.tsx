import {
  AppBar as MuiAppBar,
  AppBarProps as MuiAppBarProps,
  Box,
  Button,
  Drawer,
  IconButton,
  Toolbar,
  Typography,
} from "@material-ui/core";
import { styled } from "@material-ui/core/styles";
import { Close } from "@material-ui/icons";
import { Environment } from "@vertexvis/viewer";
import { useRouter } from "next/router";
import { signIn, useSession } from "next-auth/client";
import React from "react";

import { Header } from "../components/Header";
import { LeftDrawer } from "../components/LeftDrawer";
import { SceneTable } from "../components/SceneTable";
import { Config } from "../lib/config";
import { easeOutEntering, sharpLeaving } from "../lib/transitions";
import { isErrorRes } from "../pages/api/scenes";
import { encodeCreds } from "../pages/scene-viewer";

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
  const router = useRouter();
  const [sceneId, setSceneId] = React.useState<string | undefined>();
  const [session, loading] = useSession();

  function handleDrawerOpen(id: string) {
    setSceneId(id);
  }

  function handleDrawerClose() {
    setSceneId(undefined);
  }

  async function handleViewClick() {
    if (!clientId) return;

    const json = await (
      await fetch("/api/stream-keys", {
        body: JSON.stringify({ sceneId }),
        method: "POST",
      })
    ).json();

    if (isErrorRes(json)) console.error("Error creating stream key.");
    else router.push(encodeCreds({ clientId, streamKey: json.key, vertexEnv }));
  }

  return (
    <Box sx={{ display: "flex", height: "100vh" }}>
      <AppBar color="default" open={Boolean(sceneId)} position="fixed">
        <Toolbar variant="dense">
          <Header />
        </Toolbar>
      </AppBar>
      {session && <LeftDrawer />}
      <Main open={Boolean(sceneId)}>
        <Toolbar variant="dense" />
        {!loading && !session ? (
          <Box sx={{ alignItems: "center", display: "flex", m: 2 }}>
            <Typography sx={{ mr: 2 }}>Sign in required.</Typography>
            <Button onClick={() => signIn()}>Sign in</Button>
          </Box>
        ) : (
          <SceneTable onClick={handleDrawerOpen} />
        )}
      </Main>
      <Drawer
        anchor="right"
        open={Boolean(sceneId)}
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
        <Button onClick={handleViewClick}>View</Button>
      </Drawer>
    </Box>
  );
}
