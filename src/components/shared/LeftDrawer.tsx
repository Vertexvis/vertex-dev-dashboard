import {
  DescriptionOutlined,
  LocalLibraryOutlined,
  PhotoLibraryOutlined,
} from "@mui/icons-material";
import {
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
} from "@mui/material";
import { drawerClasses } from "@mui/material/Drawer";
import { useRouter } from "next/router";
import React from "react";

import { LeftDrawerWidth } from "../shared/Layout";

export type Content = "settings" | "instructions" | "parts";

export function LeftDrawer(): JSX.Element {
  const router = useRouter();

  return (
    <Drawer
      anchor="left"
      sx={{
        flexShrink: 0,
        width: LeftDrawerWidth,
        [`& .${drawerClasses.paper}`]: { width: LeftDrawerWidth },
      }}
      variant="permanent"
    >
      <Toolbar variant="dense" />
      <List>
        <ListItemButton
          onClick={() => router.push("/")}
          selected={router.route === "/"}
        >
          <ListItemIcon>
            <PhotoLibraryOutlined />
          </ListItemIcon>
          <ListItemText primary="Scenes" />
        </ListItemButton>
        <ListItemButton
          onClick={() => router.push("/files")}
          selected={router.route === "/files"}
        >
          <ListItemIcon>
            <DescriptionOutlined />
          </ListItemIcon>
          <ListItemText primary="Files" />
        </ListItemButton>
        <ListItemButton
          onClick={() => router.push("/parts")}
          selected={router.route === "/parts"}
        >
          <ListItemIcon>
            <LocalLibraryOutlined />
          </ListItemIcon>
          <ListItemText primary="Parts Library" />
        </ListItemButton>
      </List>
    </Drawer>
  );
}
