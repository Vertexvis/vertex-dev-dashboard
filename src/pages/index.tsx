import {
  AppBar as MuiAppBar,
  AppBarProps as MuiAppBarProps,
  Box,
  Button,
  Checkbox,
  Drawer,
  FormControlLabel,
  IconButton,
  TextField,
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
import { Scene } from "../lib/scenes";
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

const DrawerWidth = 300;

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
  const [scene, setScene] = React.useState<Scene | undefined>();
  const [session, loading] = useSession();

  function handleDrawerOpen(s: Scene) {
    setScene(s);
  }

  function handleDrawerClose() {
    setScene(undefined);
  }

  async function handleViewClick() {
    if (!clientId) return;

    const json = await (
      await fetch("/api/stream-keys", {
        body: JSON.stringify({ sceneId: scene.id }),
        method: "POST",
      })
    ).json();

    if (isErrorRes(json)) console.error("Error creating stream key.");
    else router.push(encodeCreds({ clientId, streamKey: json.key, vertexEnv }));
  }

  return (
    <Box sx={{ display: "flex", height: "100vh" }}>
      <AppBar color="default" open={Boolean(scene)} position="fixed">
        <Toolbar variant="dense">
          <Header />
        </Toolbar>
      </AppBar>
      {session && <LeftDrawer />}
      <Main open={Boolean(scene)}>
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
        open={Boolean(scene)}
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
        {scene && (
          <Box sx={{ mx: 2 }}>
            <Typography sx={{ mb: 2 }} variant="h5">
              Scene Details
            </Typography>
            <DrawerTextField label="Name" value={scene.name} />
            <DrawerTextField label="Supplied ID" value={scene.suppliedId} />
            <DrawerTextField label="ID" value={scene.id} />
            <DrawerTextField
              label="Camera"
              value={JSON.stringify(scene.camera)}
            />
            <DrawerTextField label="State" value={scene.state} />
            <FormControlLabel
              control={
                <Checkbox
                  checked={scene.treeEnabled}
                  inputProps={{ readOnly: true }}
                />
              }
              label="Tree enabled"
            />

            {scene.worldOrientation && (
              <DrawerTextField
                label="World orientation"
                value={JSON.stringify(scene.worldOrientation)}
              />
            )}
            {scene.sceneItemCount && (
              <DrawerTextField
                label="Scene item count"
                value={scene.sceneItemCount.toString()}
              />
            )}
            <DrawerTextField
              label="Created"
              value={
                scene.created
                  ? new Date(scene.created).toLocaleString()
                  : undefined
              }
            />
            <DrawerTextField
              label="Modified"
              value={
                scene.modified
                  ? new Date(scene.modified).toLocaleString()
                  : undefined
              }
            />
            <Box
              sx={{ display: "flex", justifyContent: "space-between", mt: 2 }}
            >
              {/* <Button onClick={handleViewClick}>Edit</Button> */}
              <Button
                color="primary"
                variant="contained"
                onClick={handleViewClick}
              >
                View
              </Button>
            </Box>
            {/* <TextField
            error={invalidClientId}
            helperText={invalidClientId ? "Client ID too long." : undefined}
            onChange={handleClientIdChange}
            value={inputCreds.clientId}
          /> */}
          </Box>
        )}
      </Drawer>
    </Box>
  );
}

function DrawerTextField({ label, value }: { label: string; value?: string }) {
  return (
    <TextField
      fullWidth
      InputProps={{ readOnly: true }}
      label={label}
      margin="normal"
      size="small"
      type="text"
      value={value}
    />
  );
}
