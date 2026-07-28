import { Drawer } from "@mui/material";
import { drawerClasses } from "@mui/material/Drawer";
import React from "react";

import { ViewerContext } from "../../lib/ai/viewer-command";
import { ViewerState } from "../../lib/viewer";
import { EnvironmentWithCustom, NetworkConfig } from "../../lib/with-session";
import { Title } from "../shared/Title";
import { LeftDrawerWidth } from "./Layout";
import { SceneTreePanel } from "./SceneTreePanel";

interface Props {
  readonly configEnv: EnvironmentWithCustom;
  readonly viewerId: string;
  readonly networkConfig?: NetworkConfig;
  readonly selectedItemId?: string;
  readonly viewerState: ViewerState;

  readonly onItemSelected: (itemId: string) => void;
  readonly onLoadedTreeChanged?: (
    tree: NonNullable<ViewerContext["loadedTree"]>
  ) => void;
}

export function LeftDrawer({
  configEnv,
  viewerId,
  selectedItemId,
  networkConfig,
  viewerState,
  onItemSelected,
  onLoadedTreeChanged,
}: Props): JSX.Element {
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
        Assembly
      </Title>
      <SceneTreePanel
        configEnv={configEnv}
        viewerId={viewerId}
        networkConfig={networkConfig}
        selectedItemId={selectedItemId}
        viewerState={viewerState}
        onItemSelected={onItemSelected}
        onLoadedTreeChanged={onLoadedTreeChanged}
      />
    </Drawer>
  );
}
