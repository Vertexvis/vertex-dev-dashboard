import { Box, Drawer } from "@mui/material";
import { drawerClasses } from "@mui/material/Drawer";
import React from "react";

import { ViewerState } from "../../lib/viewer";
import { EnvironmentWithCustom, NetworkConfig } from "../../lib/with-session";
import { Title } from "../shared/Title";
import { LeftDrawerWidth } from "./Layout";
import { SceneTreePanel } from "./SceneTreePanel";
import { MinDrawerWidth, useDrawerWidth } from "./useDrawerWidth";

interface Props {
  readonly active?: string;
  readonly configEnv: EnvironmentWithCustom;
  readonly viewerId: string;
  readonly networkConfig?: NetworkConfig;
  readonly selectedItemId?: string;
  readonly viewerState: ViewerState;

  readonly onItemSelected: (itemId: string) => void;
}

export function LeftDrawer({
  active,
  configEnv,
  viewerId,
  selectedItemId,
  networkConfig,
  viewerState,
  onItemSelected,
}: Props): JSX.Element {
  const { handleDoubleClick, handleKeyDown, handleMouseDown, maxWidth, width } =
    useDrawerWidth({
      anchor: "left",
      defaultWidth: LeftDrawerWidth,
      storageKey: "viewer.leftDrawerWidth",
    });

  const getDisplayedHeader = () => {
    switch (active) {
      case "scene-tree":
        return "Assembly";
      default:
        return "";
    }
  };

  const getActiveContent = () => {
    switch (active) {
      case "scene-tree":
        return (
          <SceneTreePanel
            configEnv={configEnv}
            viewerId={viewerId}
            networkConfig={networkConfig}
            selectedItemId={selectedItemId}
            viewerState={viewerState}
            onItemSelected={onItemSelected}
          />
        );
      default:
        return <></>;
    }
  };

  return (
    <Drawer
      anchor="left"
      sx={{
        display: { sm: "block", xs: "none" },
        position: "relative",
        width,
        [`& .${drawerClasses.paper}`]: { width },
      }}
      PaperProps={{
        style: { width },
        sx: {
          position: "relative",
        },
      }}
      variant="permanent"
    >
      <Box
        aria-label="Resize left drawer"
        aria-orientation="vertical"
        aria-valuemax={maxWidth}
        aria-valuemin={MinDrawerWidth}
        aria-valuenow={width}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleKeyDown}
        onMouseDown={handleMouseDown}
        role="separator"
        tabIndex={0}
        sx={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: "6px",
          cursor: "col-resize",
          zIndex: 1,
          "&:hover": { backgroundColor: "action.hover" },
        }}
      />
      <Title
        sx={{
          borderBottom: "1px solid #ccc",
        }}
      >
        {getDisplayedHeader()}
      </Title>
      {getActiveContent()}
    </Drawer>
  );
}
