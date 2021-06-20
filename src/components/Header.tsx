import { Box, IconButton, Link, Tooltip } from "@material-ui/core";
import { AccountCircleOutlined, HelpOutline } from "@material-ui/icons";
import Image from "next/image";
import React from "react";

interface Props {
  onAccountClick?: () => void;
}

export function Header({ onAccountClick }: Props): JSX.Element {
  return (
    <Box
      sx={{
        alignItems: "center",
        display: "flex",
        justifyContent: "space-between",
        width: "100%",
      }}
    >
      <Link href="/">
        <Image src="/vertex-logo.svg" alt="Vertex" width="29" height="28" />
      </Link>
      <Box>
        {onAccountClick && (
          <Tooltip title="Account">
            <IconButton onClick={() => onAccountClick()}>
              <AccountCircleOutlined />
            </IconButton>
          </Tooltip>
        )}
        <Link
          href="https://developer.vertexvis.com/support"
          rel="noreferrer"
          target="_blank"
        >
          <Tooltip title="Support">
            <IconButton>
              <HelpOutline />
            </IconButton>
          </Tooltip>
        </Link>
      </Box>
    </Box>
  );
}
