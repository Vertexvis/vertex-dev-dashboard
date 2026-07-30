import { Box, Typography } from "@mui/material";
import React from "react";

import { Title } from "../shared/Title";

export type MetadataStatus = "loading" | "error" | "ready";

export function NoData(): JSX.Element {
  return <StateMessage message="No data" />;
}

export function StateMessage({
  message,
  error = false,
}: {
  readonly message: string;
  readonly error?: boolean;
}): JSX.Element {
  return (
    <>
      <DrawerTitle />
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexGrow: 1,
        }}
      >
        <Typography
          role={error ? "alert" : undefined}
          sx={{ color: error ? "error.main" : undefined, mx: 2, mb: 2 }}
          variant="body2"
        >
          {message}
        </Typography>
      </Box>
    </>
  );
}

export function DrawerTitle(): JSX.Element {
  return (
    <Title
      sx={{
        borderBottom: "1px solid #ccc",
      }}
    >
      Properties
    </Title>
  );
}
