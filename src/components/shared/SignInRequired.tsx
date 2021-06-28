import { Box, Button, Typography } from "@material-ui/core";
import { signIn } from "next-auth/client";
import React from "react";

export function SignInRequired(): JSX.Element {
  return (
    <Box sx={{ alignItems: "center", display: "flex", m: 2 }}>
      <Typography sx={{ mr: 2 }}>Sign in required.</Typography>
      <Button onClick={() => signIn()}>Sign in</Button>
    </Box>
  );
}
