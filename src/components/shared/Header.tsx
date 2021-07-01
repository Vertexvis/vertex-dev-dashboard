/* @jsx jsx */ /** @jsxRuntime classic */ import { jsx } from "@emotion/react";
import { Box, IconButton, Link } from "@material-ui/core";
import { Menu as MenuIcon } from "@material-ui/icons";
import Image from "next/image";

interface Props {
  readonly onMenuClick?: () => void;
  readonly open?: boolean;
}

export function Header({ onMenuClick, open }: Props): JSX.Element {
  return (
    <Box
      sx={{
        alignItems: "center",
        display: "flex",
        justifyContent: "space-between",
        width: "100%",
      }}
    >
      <Box
        sx={{
          alignItems: "center",
          display: "flex",
        }}
      >
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
    </Box>
  );
}
