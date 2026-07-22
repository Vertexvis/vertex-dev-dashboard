import {
  AdminPanelSettingsOutlined,
  CollectionsBookmarkOutlined,
  DatasetOutlined,
  DescriptionOutlined,
  LocalLibraryOutlined,
  PendingOutlined,
  SearchOutlined,
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
import { AppLink } from "./AppLink";

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
          onClick={() => router.push("/")}
          selected={router.route === "/"}
        >
          <ListItemIcon>
            <LocalLibraryOutlined />
          </ListItemIcon>
          <ListItemText primary="Scenes" />
        </ListItemButton>
        <ListItemButton
          component={AppLink}
          href="/scenes-preview"
          selected={router.route === "/scenes-preview"}
          underline="none"
        >
          <ListItemIcon>
            <LocalLibraryOutlined />
          </ListItemIcon>
          <ListItemText primary="Scenes (Preview)" />
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
          onClick={() => router.push("/documents")}
          selected={router.route === "/documents"}
        >
          <ListItemIcon>
            <DescriptionOutlined />
          </ListItemIcon>
          <ListItemText primary="Documents (Preview)" />
        </ListItemButton>
        <ListItemButton
          onClick={() => router.push("/properties-search")}
          selected={router.route === "/properties-search"}
        >
          <ListItemIcon>
            <SearchOutlined />
          </ListItemIcon>
          <ListItemText primary="Properties & Search" />
        </ListItemButton>
        <ListItemButton
          component={AppLink}
          href="/identity-admin"
          selected={router.route === "/identity-admin"}
          underline="none"
        >
          <ListItemIcon>
            <AdminPanelSettingsOutlined />
          </ListItemIcon>
          <ListItemText primary="Identity & Administration" />
        </ListItemButton>
        <ListItemButton
          onClick={() => router.push("/file-collections")}
          selected={router.route === "/file-collections"}
        >
          <ListItemIcon>
            <CollectionsBookmarkOutlined />
          </ListItemIcon>
          <ListItemText primary="File Collections" />
        </ListItemButton>
        <ListItemButton
          onClick={() => router.push("/parts")}
          selected={router.route === "/parts"}
        >
          <ListItemIcon>
            <DatasetOutlined />
          </ListItemIcon>
          <ListItemText primary="Parts Library" />
        </ListItemButton>
        <ListItemButton
          onClick={() => router.push("/translations")}
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
