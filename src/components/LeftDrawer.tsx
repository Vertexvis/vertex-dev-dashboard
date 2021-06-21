import {
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
} from "@material-ui/core";
import { drawerClasses } from "@material-ui/core/Drawer";
import { DescriptionOutlined, PhotoLibraryOutlined } from "@material-ui/icons";
import { useRouter } from "next/router";
import React from "react";

import { LeftDrawerWidth } from "./Layout";

export type Content = "settings" | "instructions" | "parts";

export function LeftDrawer(): JSX.Element {
  const router = useRouter();

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
        <ListItemButton onClick={() => router.push("/")}>
          <ListItemIcon>
            <PhotoLibraryOutlined />
          </ListItemIcon>
          <ListItemText primary="Scenes" />
        </ListItemButton>
        <ListItemButton onClick={() => router.push("/files")}>
          <ListItemIcon>
            <DescriptionOutlined />
          </ListItemIcon>
          <ListItemText primary="Files" />
        </ListItemButton>
      </List>
    </Drawer>
  );
}
