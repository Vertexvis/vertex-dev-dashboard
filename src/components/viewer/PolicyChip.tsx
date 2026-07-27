import { Chip } from "@mui/material";
import { PropertyKeyPolicyData } from "@vertexvis/api-client-node";
import React from "react";
import useSWR from "swr";

import { GetRes } from "../../lib/api";
import {
  PropertyKeyPolicyMode,
  toPolicyPage,
} from "../../lib/property-key-policies";

interface Props {
  readonly policyId?: string;
}

// Keep the policy lookup local to the viewer — SceneTable owns its own copy.
export function PolicyChip({ policyId }: Props): JSX.Element {
  const { data } = useSWR<GetRes<PropertyKeyPolicyData>>(
    policyId ? "/api/property-key-policies" : null
  );

  if (!policyId) return <></>;

  const policy = data
    ? toPolicyPage(data).items.find((p) => p.id === policyId)
    : undefined;

  const label = policy
    ? `${policy.name ?? policy.id} (${modeLabel(policy.mode)})`
    : "Loading policy...";

  return (
    <Chip
      color="primary"
      label={`Policy: ${label}`}
      size="small"
      variant="outlined"
    />
  );
}

function modeLabel(mode: PropertyKeyPolicyMode): string {
  return mode === PropertyKeyPolicyMode.Allowlist ? "Allowlist" : "Denylist";
}
