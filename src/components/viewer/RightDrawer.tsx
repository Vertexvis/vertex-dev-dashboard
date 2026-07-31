import { Drawer } from "@mui/material";
import { drawerClasses } from "@mui/material/Drawer";
import { SceneViewStateData } from "@vertexvis/api-client-node";
import React from "react";

import { Metadata } from "../../lib/metadata";
import { ModelViewsState } from "../../lib/model-views";
import { RightDrawerWidth } from "./Layout";
import { MetadataCompare } from "./MetadataCompare";
import { MetadataStatus } from "./MetadataStates";
import { ModelViews } from "./ModelViews";
import { SceneViewStateList } from "./SceneViewStateList";

interface Props {
  readonly active?: string;
  readonly metadata?: Metadata;
  readonly unrestrictedMetadata?: Metadata;
  readonly streamMetadata?: Metadata;
  readonly metadataStatus?: MetadataStatus;
  readonly metadataError?: string;
  readonly metadataDiagnostic?: string;
  readonly modelViews: ModelViewsState;
  readonly sceneViewStates?: SceneViewStateData[];
  readonly onViewStateSelected: (arg0: string) => void;
}

export function RightDrawer({
  active,
  metadata,
  unrestrictedMetadata,
  streamMetadata,
  metadataStatus,
  metadataError,
  metadataDiagnostic,
  modelViews,
  sceneViewStates,
  onViewStateSelected,
}: Props): JSX.Element {
  const getDisplayedContent = () => {
    switch (active) {
      case "properties":
        return (
          <MetadataCompare
            unrestricted={unrestrictedMetadata}
            restricted={metadata}
            stream={streamMetadata}
            status={metadataStatus}
            error={metadataError}
            diagnostic={metadataDiagnostic}
          />
        );
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
