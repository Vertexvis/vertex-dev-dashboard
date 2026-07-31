import type { SxProps, Theme } from "@mui/material";
import {
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";
import React from "react";
import useSWR from "swr";

import {
  PropertyKeyPolicyPageRes,
  toPropertyKeyPolicyPage,
} from "../../lib/property-key-policies";

interface Props {
  readonly policyId?: string;
  readonly onChange: (policyId?: string) => void;
  readonly disabled?: boolean;
  readonly sx?: SxProps<Theme>;
  readonly margin?: "dense" | "none" | "normal";
}

export function PolicySelect({
  policyId,
  onChange,
  disabled = false,
  sx,
  margin,
}: Props): JSX.Element {
  const { data, error } = useSWR<PropertyKeyPolicyPageRes>(
    "/api/property-key-policies"
  );
  const loading = !data && !error;
  const policies = data ? toPropertyKeyPolicyPage(data).items : [];
  const selectedPolicyId = policies.some((policy) => policy.id === policyId)
    ? policyId
    : "";

  return (
    <FormControl
      variant="standard"
      size="small"
      margin={margin}
      sx={sx}
      disabled={disabled || loading || !!error}
    >
      <InputLabel id="property-key-policy-label">
        Property Key Policy
      </InputLabel>
      <Select
        labelId="property-key-policy-label"
        id="property-key-policy"
        value={selectedPolicyId}
        onChange={(event) => onChange(event.target.value || undefined)}
        endAdornment={
          loading ? <CircularProgress size={16} sx={{ mr: 2 }} /> : undefined
        }
      >
        <MenuItem value="">
          <em>None (unrestricted)</em>
        </MenuItem>
        {policies.map((policy) => (
          <MenuItem key={policy.id} value={policy.id}>
            {policy.name ?? policy.suppliedId ?? policy.id}{" "}
            <Typography
              component="span"
              variant="caption"
              color="text.secondary"
              sx={{ ml: 0.5 }}
            >
              ({policy.mode})
            </Typography>
          </MenuItem>
        ))}
      </Select>
      {error && (
        <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
          Could not load policies
        </Typography>
      )}
    </FormControl>
  );
}
