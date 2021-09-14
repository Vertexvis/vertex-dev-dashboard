/* @jsx jsx */ /** @jsxRuntime classic */ import { jsx } from "@emotion/react";
import { Box, Button, IconButton, Link } from "@mui/material";
import { Menu as MenuIcon } from "@mui/icons-material";
import Image from "next/image";
import { useRouter } from "next/router";

interface Props {
  readonly onMenuClick?: () => void;
  readonly open?: boolean;
}

export function Header({ onMenuClick, open }: Props): JSX.Element {
  const router = useRouter();

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
      }}
    >
      <Box sx={{ alignItems: "center", display: "flex" }}>
        {onMenuClick && (
          <IconButton
            color="inherit"
            onClick={onMenuClick}
            edge="start"
            sx={{ display: open ? "none" : "block", mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
        )}
        <Link href="/">
          <Image src="/vertex-logo.svg" alt="Vertex" width="29" height="28" />
        </Link>
      </Box>
      <Box sx={{ ml: "auto" }}>
        <Button onClick={handleSignOut}>Sign Out</Button>
      </Box>
    </Box>
  );
}
