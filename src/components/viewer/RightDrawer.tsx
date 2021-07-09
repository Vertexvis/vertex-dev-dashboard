import {
  Accordion,
  AccordionSummary,
  Drawer,
  Typography,
} from "@material-ui/core";
import { drawerClasses } from "@material-ui/core/Drawer";
import { styled } from "@material-ui/core/styles";
import { ExpandMore } from "@material-ui/icons";
import { SceneViewStateData } from "@vertexvis/api-client-node";
import React from "react";

import { Metadata } from "../../lib/metadata";
import { RightDrawerWidth } from "./Layout";
import { MetadataProperties } from "./MetadataProperties";
import { SceneViewStateList } from "./SceneViewStateList";

interface Props {
  readonly metadata?: Metadata;
  readonly sceneViewStates?: SceneViewStateData[];
  readonly onViewStateSelected: (arg0: string) => void;
}

const Title = styled((props) => <Typography variant="body2" {...props} />)(
  () => ({ textTransform: "uppercase" })
);

export function RightDrawer({
  metadata,
  sceneViewStates,
  onViewStateSelected,
}: Props): JSX.Element {
  return (
    <Drawer
      anchor="right"
      sx={{
        display: { sm: "block", xs: "none" },
        width: RightDrawerWidth,
        [`& .${drawerClasses.paper}`]: { width: RightDrawerWidth },
      }}
      variant="permanent"
    >
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Title>Metadata Properties</Title>
        </AccordionSummary>
        <MetadataProperties metadata={metadata} />
      </Accordion>
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Title>Scene View States</Title>
        </AccordionSummary>
        <SceneViewStateList
          sceneViewStates={sceneViewStates}
          onViewStateSelected={onViewStateSelected}
        />
      </Accordion>
    </Drawer>
  );
}
