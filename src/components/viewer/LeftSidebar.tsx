import {
  CameraAltOutlined as CameraAltOutlinedIcon,
  InfoOutlined as InfoOutlinedIcon,
  Menu as MenuIcon,
  ViewInAr as ViewInArIcon,
} from "@mui/icons-material";
import { Box, Drawer, IconButton } from "@mui/material";
import { drawerClasses } from "@mui/material/Drawer";
import React from "react";

import { LeftDrawerWidth } from "./Layout";
import { SidebarIcon } from "./SidebarIcon";

export interface Props {
  readonly active?: string;

  readonly onSelectSidebar: (name?: string) => void;
}

export const LeftSidebar = ({
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
        borderRight: "1px solid #ccc",
      }}
    >
      <SidebarIcon
        active={active}
        name="scene-tree"
        tooltip="Assembly"
        onSelectSidebar={onSelectSidebar}
      >
        <MenuIcon />
      </SidebarIcon>
    </Box>
  );
};
