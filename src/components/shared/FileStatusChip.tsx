import { Chip } from "@mui/material";
import React from "react";

import { FileStatusComplete, normalizeFileStatus } from "../../lib/files";

interface Props {
  readonly status?: string;
}

function statusLabel(status?: string): string {
  return status ?? "N/A";
}

function statusColor(
  status?: string
): "default" | "success" | "warning" | "error" {
  switch (normalizeFileStatus(status)) {
    case FileStatusComplete:
      return "success";
    case "pending":
      return "warning";
    case "error":
    case "failed":
      return "error";
    default:
      return "default";
  }
}

export function FileStatusChip({ status }: Props): JSX.Element {
  return (
    <Chip
      color={statusColor(status)}
      label={statusLabel(status)}
      size="small"
      sx={{ fontWeight: 600, textTransform: "uppercase" }}
      variant="outlined"
    />
  );
}
