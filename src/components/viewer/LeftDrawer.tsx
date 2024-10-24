import { Drawer } from "@mui/material";
import { drawerClasses } from "@mui/material/Drawer";
import React from "react";

import { ViewerState } from "../../lib/viewer";
import { EnvironmentWithCustom, NetworkConfig } from "../../lib/with-session";
import { Title } from "../shared/Title";
import { LeftDrawerWidth } from "./Layout";
import { SceneTreePanel } from "./SceneTreePanel";

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
        width: LeftDrawerWidth,
        [`& .${drawerClasses.paper}`]: { width: LeftDrawerWidth },
      }}
      PaperProps={{
        sx: {
          position: "relative",
        },
      }}
      variant="permanent"
    >
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
