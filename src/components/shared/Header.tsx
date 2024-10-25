/* @jsx jsx */ /** @jsxRuntime classic */ import { jsx } from "@emotion/react";
import { Box, Button, Link } from "@mui/material";
import Image from "next/image";
import { useRouter } from "next/router";

export function Header(): JSX.Element {
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
        <Link href="/" paddingRight={"16px"}>
          <Image src="/vertex-logo.svg" alt="Vertex" width="29" height="28" />
        </Link>
        <p>Vertex Developer Dashboard</p>
      </Box>
      <Box sx={{ ml: "auto" }}>
        <Button onClick={handleSignOut}>Sign Out</Button>
      </Box>
    </Box>
  );
}
