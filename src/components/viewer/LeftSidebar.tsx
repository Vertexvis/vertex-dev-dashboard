import { Menu as MenuIcon } from "@mui/icons-material";
import { Box } from "@mui/material";
import React from "react";

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
