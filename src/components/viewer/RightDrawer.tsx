import { Drawer } from "@mui/material";
import { drawerClasses } from "@mui/material/Drawer";
import { SceneViewStateData } from "@vertexvis/api-client-node";
import React from "react";

import { Metadata } from "../../lib/metadata";
import { ModelViewsState } from "../../lib/model-views";
import { RightDrawerWidth } from "./Layout";
import { MetadataProperties } from "./MetadataProperties";
import { ModelViews } from "./ModelViews";
import { SceneViewStateList } from "./SceneViewStateList";

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
        width: RightDrawerWidth,
        [`& .${drawerClasses.paper}`]: { width: RightDrawerWidth },
      }}
      PaperProps={{
        sx: {
          position: "relative",
        },
      }}
      variant="permanent"
    >
      {getDisplayedContent()}
    </Drawer>
  );
}
