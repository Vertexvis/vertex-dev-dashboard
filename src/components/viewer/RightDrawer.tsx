import { Box, Drawer } from "@mui/material";
import { drawerClasses } from "@mui/material/Drawer";
import { SceneViewStateData } from "@vertexvis/api-client-node";
import React from "react";

import { Metadata } from "../../lib/metadata";
import { ModelViewsState } from "../../lib/model-views";
import { RightDrawerWidth } from "./Layout";
import { MetadataProperties } from "./MetadataProperties";
import { ModelViews } from "./ModelViews";
import { SceneViewStateList } from "./SceneViewStateList";
import { MinDrawerWidth, useDrawerWidth } from "./useDrawerWidth";

interface Props {
  readonly active?: string;
  readonly metadata?: Metadata;
  readonly modelViews: ModelViewsState;
  readonly sceneViewStates?: SceneViewStateData[];
  readonly onViewStateSelected: (arg0: string) => void;
}

export function RightDrawer({
  active,
  metadata,
  modelViews,
  sceneViewStates,
  onViewStateSelected,
}: Props): JSX.Element {
  const { handleDoubleClick, handleKeyDown, handleMouseDown, maxWidth, width } =
    useDrawerWidth({
      anchor: "right",
      defaultWidth: RightDrawerWidth,
      storageKey: "viewer.rightDrawerWidth",
    });

  const getDisplayedContent = () => {
    switch (active) {
      case "properties":
        return <MetadataProperties metadata={metadata} />;
      case "scene-view-states":
        return (
          <SceneViewStateList
            sceneViewStates={sceneViewStates}
            onViewStateSelected={onViewStateSelected}
          />
        );
      case "model-views":
        return <ModelViews modelViews={modelViews} metadata={metadata} />;
      default:
        return <></>;
    }
  };

  return (
    <Drawer
      anchor="right"
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
        aria-label="Resize right drawer"
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
          left: 0,
          bottom: 0,
          width: "6px",
          cursor: "col-resize",
          zIndex: 1,
          "&:hover": { backgroundColor: "action.hover" },
        }}
      />
      {getDisplayedContent()}
    </Drawer>
  );
}
