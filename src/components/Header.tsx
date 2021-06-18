import { Box, Link, Tooltip } from "@material-ui/core";
import { HelpOutline } from "@material-ui/icons";
import Image from "next/image";
import React from "react";

export function Header(): JSX.Element {
  return (
    <Box display="flex" justifyContent="space-between" width="100%">
      <Link href="/">
        <Image src="/vertex-logo.svg" alt="Vertex" width="29" height="28" />
      </Link>
      <Tooltip title="Support">
        <Link
          href="https://developer.vertexvis.com/support"
          rel="noreferrer"
          style={{ alignSelf: "center" }}
          target="_blank"
        >
          <HelpOutline />
        </Link>
      </Tooltip>
    </Box>
  );
}
