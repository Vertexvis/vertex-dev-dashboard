import {
  CollectionsBookmarkOutlined,
  DatasetOutlined,
  DescriptionOutlined,
  LocalLibraryOutlined,
  PendingOutlined,
  VpnKeyOutlined,
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

import { reportError } from "../../lib/report-error";
import { LeftDrawerWidth } from "../shared/Layout";

export type Content = "settings" | "instructions" | "parts";

export function LeftDrawer(): JSX.Element {
  const router = useRouter();

  const isSectionActive = React.useCallback(
    (base: string) =>
      router.route === base || router.route.startsWith(`${base}/`),
    [router.route]
  );

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
          onClick={() => {
            router.push("/").catch(reportError("Failed to navigate to /"));
          }}
          selected={router.route === "/" || isSectionActive("/scene-viewer")}
        >
          <ListItemIcon>
            <LocalLibraryOutlined />
          </ListItemIcon>
          <ListItemText primary="Scenes" />
        </ListItemButton>
        <ListItemButton
          onClick={() => {
            router
              .push("/files")
              .catch(reportError("Failed to navigate to /files"));
          }}
          selected={isSectionActive("/files")}
        >
          <ListItemIcon>
            <DescriptionOutlined />
          </ListItemIcon>
          <ListItemText primary="Files" />
        </ListItemButton>
        <ListItemButton
          onClick={() => {
            router
              .push("/file-collections")
              .catch(reportError("Failed to navigate to /file-collections"));
          }}
          selected={isSectionActive("/file-collections")}
        >
          <ListItemIcon>
            <CollectionsBookmarkOutlined />
          </ListItemIcon>
          <ListItemText primary="File Collections" />
        </ListItemButton>
        <ListItemButton
          onClick={() => {
            router
              .push("/property-key-policies")
              .catch(
                reportError("Failed to navigate to /property-key-policies")
              );
          }}
          selected={router.route === "/property-key-policies"}
        >
          <ListItemIcon>
            <VpnKeyOutlined />
          </ListItemIcon>
          <ListItemText primary="Property Key Policies" />
        </ListItemButton>
        <ListItemButton
          onClick={() => {
            router
              .push("/parts")
              .catch(reportError("Failed to navigate to /parts"));
          }}
          selected={isSectionActive("/parts")}
        >
          <ListItemIcon>
            <DatasetOutlined />
          </ListItemIcon>
          <ListItemText primary="Parts Library" />
        </ListItemButton>
        <ListItemButton
          onClick={() => {
            router
              .push("/translations")
              .catch(reportError("Failed to navigate to /translations"));
          }}
          selected={isSectionActive("/translations")}
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
