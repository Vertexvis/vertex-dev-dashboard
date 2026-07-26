/* @jsx jsx */ /** @jsxRuntime classic */ import { jsx } from "@emotion/react";
import { SettingsOutlined } from "@mui/icons-material";
import { Box, Button, IconButton, Tooltip } from "@mui/material";
import Image from "next/image";
import { useRouter } from "next/router";
import React from "react";

import { AppLink } from "./AppLink";
import { SettingsDrawer } from "./SettingsDrawer";

export function Header(): JSX.Element {
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  async function handleSignOut() {
    await fetch("/api/logout");
    router.push("/login");
  }

  return (
    <Box
      sx={{
        alignItems: "center",
        display: "flex",
        justifyContent: "space-between",
        width: "100%",
        height: "56px",
      }}
    >
      <Box sx={{ alignItems: "center", display: "flex" }}>
        <AppLink href="/" paddingRight={"16px"}>
          <Image src="/vertex-logo.svg" alt="Vertex" width="29" height="28" />
        </AppLink>
        <p>Vertex Developer Dashboard</p>
      </Box>
      <Box sx={{ ml: "auto", alignItems: "center", display: "flex" }}>
        <Tooltip title="Settings">
          <IconButton
            aria-label="Open settings"
            onClick={() => setSettingsOpen(true)}
          >
            <SettingsOutlined />
          </IconButton>
        </Tooltip>
        <Button onClick={handleSignOut}>Sign Out</Button>
      </Box>
      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </Box>
  );
}
