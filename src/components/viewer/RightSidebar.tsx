import {
  CameraAltOutlined as CameraAltOutlinedIcon,
  InfoOutlined as InfoOutlinedIcon,
  ViewInAr as ViewInArIcon,
} from "@mui/icons-material";
import { Box } from "@mui/material";
import React from "react";

import { SidebarIcon } from "./SidebarIcon";

export interface Props {
  readonly active?: string;

  readonly onSelectSidebar: (name?: string) => void;
}

export const RightSidebar = ({
  active,
  onSelectSidebar,
}: Props): JSX.Element => {
  return (
    <Box
      sx={{
        padding: "1rem 0.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        borderLeft: "1px solid #ccc",
      }}
    >
      <SidebarIcon
        active={active}
        name="properties"
        tooltip="Properties"
        onSelectSidebar={onSelectSidebar}
      >
        <InfoOutlinedIcon />
      </SidebarIcon>
      <SidebarIcon
        active={active}
        name="scene-view-states"
        tooltip="Scene View States"
        onSelectSidebar={onSelectSidebar}
      >
        <CameraAltOutlinedIcon />
      </SidebarIcon>
      <SidebarIcon
        active={active}
        name="model-views"
        tooltip="Model Views"
        onSelectSidebar={onSelectSidebar}
      >
        <ViewInArIcon />
      </SidebarIcon>
    </Box>
  );
};
