import {
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
} from "@material-ui/core";
import { drawerClasses } from "@material-ui/core/Drawer";
import { BackupTableOutlined } from "@material-ui/icons";
import React from "react";

import { LeftDrawerWidth } from "./Layout";

export type Content = "settings" | "instructions" | "parts";

export function LeftDrawer(): JSX.Element {
  return (
    <Drawer
      anchor="left"
      sx={{
        flexShrink: 0,
        width: LeftDrawerWidth,
        [`& .${drawerClasses.paper}`]: {
          width: LeftDrawerWidth,
          boxSizing: "border-box",
        },
      }}
      variant="permanent"
    >
      <Toolbar variant="dense" />
      <List>
        <ListItemButton>
          <ListItemIcon>
            <BackupTableOutlined />
          </ListItemIcon>
          <ListItemText primary="Scenes" />
        </ListItemButton>
      </List>
    </Drawer>
  );
}
