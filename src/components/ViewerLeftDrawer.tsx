import { Box, Divider, Drawer, IconButton } from "@material-ui/core";
import { drawerClasses } from "@material-ui/core/Drawer";
import { ChevronLeft } from "@material-ui/icons";
import { Environment } from "@vertexvis/viewer/dist/types/config/environment";
import React from "react";

import { LeftDrawerWidth } from "./Layout";
import { SceneTree } from "./SceneTree";

interface Props {
  readonly configEnv: Environment;
  readonly onClose: () => void;
  readonly open: boolean;
  readonly viewerId: string;
}

export function ViewerLeftDrawer({
  configEnv,
  onClose,
  open,
  viewerId,
}: Props): JSX.Element {
  return (
    <Drawer
      anchor="left"
      open={open}
      variant="persistent"
      sx={{
        [`& .${drawerClasses.paper}`]: { position: "relative", width: 0 },
        [`& .${drawerClasses.paperAnchorLeft}`]: { width: LeftDrawerWidth },
      }}
    >
      <Box
        sx={{
          alignItems: "center",
          display: "flex",
          justifyContent: "flex-end",
          py: 1,
        }}
      >
        <IconButton onClick={onClose}>
          <ChevronLeft />
        </IconButton>
      </Box>
      <Divider />
      <SceneTree configEnv={configEnv} viewerId={viewerId} />
    </Drawer>
  );
}
