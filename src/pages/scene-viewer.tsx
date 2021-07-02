import {
  Autocomplete,
  Box,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  TextField,
} from "@material-ui/core";
import { FileCopyOutlined, ZoomOutMapOutlined } from "@material-ui/icons";
import { vertexvis } from "@vertexvis/frame-streaming-protos";
import { Environment } from "@vertexvis/viewer";
import { useRouter } from "next/router";
import React from "react";
import { useHotkeys } from "react-hotkeys-hook";

import { Header } from "../components/shared/Header";
import { Layout } from "../components/viewer/Layout";
import { LeftDrawer } from "../components/viewer/LeftDrawer";
import { RightDrawer } from "../components/viewer/RightDrawer";
import { Viewer } from "../components/viewer/Viewer";
import { head, StreamCredentials } from "../lib/config";
import { Metadata, toMetadata } from "../lib/metadata";
import { fitAll, selectByHit } from "../lib/scene-items";
import useMousePosition, { MousePosition } from "../lib/useMousePosition";
import { useViewer } from "../lib/viewer";

const ItemHeight = 51;
const ViewerId = "vertex-viewer-id";

interface Option {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly onClick: () => void;
}

export default function SceneViewer(): JSX.Element {
  const router = useRouter();
  const viewer = useViewer();
  const [contextMenu, setContextMenu] = React.useState<
    MousePosition | undefined
  >();
  const [credentials, setCredentials] = React.useState<
    StreamCredentials | undefined
  >();
  const [selectedItemId, setSelectedItemId] = React.useState<
    string | undefined
  >();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [metadata, setMetadata] = React.useState<Metadata | undefined>();

  const options: Option[] = [
    {
      icon: <ZoomOutMapOutlined fontSize="small" />,
      label: "Fit All",
      onClick: () => fitAll({ viewer: viewer.ref.current }),
    },
    {
      icon: <FileCopyOutlined fontSize="small" />,
      label: "Copy camera",
      onClick: () => console.log("Clicked copy-camera"),
    },
  ];

  // Prefer credentials in URL to enable easy scene sharing. If empty, use defaults.
  React.useEffect(() => {
    if (!router.isReady) return;

    const cId = head(router.query.clientId);
    const sk = head(router.query.streamKey);
    const ve = head(router.query.vertexEnv);
    setCredentials(
      cId && sk && ve
        ? { clientId: cId, streamKey: sk, vertexEnv: ve as Environment }
        : undefined
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  // On credentials changes, update URL.
  React.useEffect(() => {
    if (credentials) router.push(encodeCreds(credentials));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credentials]);

  const mousePosition = useMousePosition();

  // Open dialog if 'o' key pressed
  useHotkeys("s", () => handleContextMenu(), { keyup: true }, [mousePosition]);

  function handleClose() {
    setContextMenu(undefined);
  }

  function handleContextMenu() {
    console.log(mousePosition);
    if (mousePosition == null) return;

    const { x, y } = mousePosition;
    setContextMenu(contextMenu == null ? { x: x - 2, y: y - 4 } : undefined);
  }

  async function handleSelect(hit?: vertexvis.protobuf.stream.IHit) {
    console.debug({
      hitNormal: hit?.hitNormal,
      hitPoint: hit?.hitPoint,
      partName: hit?.metadata?.partName,
      sceneItemId: hit?.itemId?.hex,
      sceneItemSuppliedId: hit?.itemSuppliedId?.value,
    });
    setMetadata(toMetadata({ hit }));
    setSelectedItemId(hit?.itemId?.hex ? hit?.itemId?.hex : undefined);
    await selectByHit({ hit, viewer: viewer.ref.current });
  }

  return router.isReady && credentials ? (
    <Layout
      header={
        <Header
          onMenuClick={() => setDrawerOpen(!drawerOpen)}
          open={drawerOpen}
        />
      }
      leftDrawer={
        <LeftDrawer
          configEnv={credentials.vertexEnv}
          onClose={() => setDrawerOpen(false)}
          open={drawerOpen}
          viewerId={ViewerId}
          selectedItemdId={selectedItemId}
        />
      }
      leftDrawerOpen={drawerOpen}
      main={
        viewer.isReady && (
          <Box sx={{ height: "100%", width: "100%" }}>
            <Viewer
              credentials={credentials}
              onSelect={handleSelect}
              viewer={viewer.ref}
              viewerId={ViewerId}
            />
            <Menu
              anchorPosition={
                contextMenu
                  ? { top: contextMenu.y, left: contextMenu.x }
                  : undefined
              }
              anchorReference={contextMenu ? "anchorPosition" : "none"}
              onClose={handleClose}
              open={contextMenu != null}
              PaperProps={{ style: { minHeight: ItemHeight * 3 } }}
            >
              <Autocomplete<Option>
                isOptionEqualToValue={(option, value) =>
                  option.label === value.label
                }
                options={options}
                size="small"
                renderInput={(params) => (
                  <TextField {...params} label="Search" />
                )}
                renderOption={(props, option) => (
                  <MenuItem
                    {...props}
                    onClick={() => {
                      option.onClick();
                      handleClose();
                    }}
                  >
                    <ListItemIcon>{option.icon}</ListItemIcon>
                    <ListItemText>{option.label}</ListItemText>
                  </MenuItem>
                )}
                sx={{ p: 1, width: 300 }}
              />
            </Menu>
          </Box>
        )
      }
      rightDrawer={<RightDrawer metadata={metadata} />}
      rightDrawerOpen
    />
  ) : (
    <></>
  );
}

export function encodeCreds({
  clientId,
  streamKey,
  vertexEnv,
}: {
  clientId: string;
  streamKey: string;
  vertexEnv: Environment;
}): string {
  const path = "scene-viewer";
  const cId = `clientId=${encodeURIComponent(clientId)}`;
  const sk = `streamKey=${encodeURIComponent(streamKey)}`;
  const ve = `vertexEnv=${encodeURIComponent(vertexEnv)}`;
  return `${path}/?${cId}&${sk}&${ve}`;
}
