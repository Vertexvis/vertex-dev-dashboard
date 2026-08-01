import { Chip } from "@mui/material";

import { PropertyKeyPolicyMode } from "../../lib/property-key-policies";
import { toModeLabel } from "./mode";

interface Props {
  readonly mode: PropertyKeyPolicyMode;
}

function modeColor(
  mode: PropertyKeyPolicyMode,
): "default" | "success" | "error" {
  switch (mode) {
    case PropertyKeyPolicyMode.Allowlist:
      return "success";
    case PropertyKeyPolicyMode.Denylist:
      return "error";
    default:
      return "default";
  }
}

export function PropertyKeyPolicyModeChip({ mode }: Props): JSX.Element {
  return (
    <Chip
      color={modeColor(mode)}
      label={toModeLabel(mode)}
      size="small"
      sx={{ fontWeight: 600, textTransform: "uppercase" }}
      variant="outlined"
    />
  );
}
