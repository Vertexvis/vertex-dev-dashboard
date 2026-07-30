import {
  CollectionsBookmarkOutlined,
  DatasetOutlined,
  DescriptionOutlined,
  LocalLibraryOutlined,
  PendingOutlined,
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

import { AppLinkBehavior } from "./AppLink";
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
        [`& .${drawerClasses.paper}`]: { width: LeftDrawerWidth },
      }}
      variant="permanent"
    >
      <Toolbar variant="dense" />
      <List
        sx={{
          paddingTop: "15px",
        }}
      >
        <ListItemButton
          component={AppLinkBehavior}
          href="/"
          selected={router.route === "/"}
        >
          <ListItemIcon>
            <LocalLibraryOutlined />
          </ListItemIcon>
          <ListItemText primary="Scenes" />
        </ListItemButton>
        <ListItemButton
          component={AppLinkBehavior}
          href="/files"
          selected={router.route === "/files"}
        >
          <ListItemIcon>
            <DescriptionOutlined />
          </ListItemIcon>
          <ListItemText primary="Files" />
        </ListItemButton>
        <ListItemButton
          component={AppLinkBehavior}
          href="/file-collections"
          selected={router.route === "/file-collections"}
        >
          <ListItemIcon>
            <CollectionsBookmarkOutlined />
          </ListItemIcon>
          <ListItemText primary="File Collections" />
        </ListItemButton>
        <ListItemButton
          component={AppLinkBehavior}
          href="/parts"
          selected={router.route === "/parts"}
        >
          <ListItemIcon>
            <DatasetOutlined />
          </ListItemIcon>
          <ListItemText primary="Parts Library" />
        </ListItemButton>
        <ListItemButton
          component={AppLinkBehavior}
          href="/translations"
          selected={router.route === "/translations"}
        >
          <ListItemIcon>
            <PendingOutlined />
          </ListItemIcon>
          <ListItemText primary="Translations" />
        </ListItemButton>
      </List>
    </Drawer>
  );
}
