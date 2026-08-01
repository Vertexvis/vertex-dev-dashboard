import { PropertyKeyPolicyMode } from "@vertexvis/api-client-node";

import type {
  GetPropertyKeyPolicyKeysRes,
  GetPropertyKeyPolicyRes,
  PropertyKeyPolicyKeyResource,
  PropertyKeyPolicyPageRes,
  PropertyKeyPolicyResource,
} from "../../../src/lib/property-key-policies";

export function propertyKeyPolicy(overrides: {
  readonly createdAt?: string;
  readonly id: string;
  readonly mode?: PropertyKeyPolicyMode;
  readonly name?: string;
  readonly suppliedId?: string;
}): PropertyKeyPolicyResource {
  return {
    attributes: {
      createdAt: overrides.createdAt ?? "2026-06-10T15:30:00Z",
      mode: overrides.mode ?? PropertyKeyPolicyMode.Allowlist,
      name: overrides.name,
      suppliedId: overrides.suppliedId,
    },
    id: overrides.id,
    type: "property-key-policy",
  };
}

export function propertyKeyPoliciesPage({
  cursors = { self: "page-1" },
  data,
}: {
  readonly cursors?: {
    readonly next?: string;
    readonly self?: string;
  };
  readonly data: readonly PropertyKeyPolicyResource[];
}): PropertyKeyPolicyPageRes {
  return {
    cursors,
    data: [...data],
    status: 200,
  };
}

export function propertyKeyPolicyRes(
  policy: PropertyKeyPolicyResource
): GetPropertyKeyPolicyRes {
  return { data: policy, status: 200 };
}

export function propertyKeyPolicyKey(overrides: {
  readonly id: string;
  readonly name: string;
}): PropertyKeyPolicyKeyResource {
  return {
    attributes: { name: overrides.name },
    id: overrides.id,
    type: "property-key",
  };
}

export function propertyKeyPolicyKeysRes({
  data,
}: {
  readonly data: readonly PropertyKeyPolicyKeyResource[];
}): GetPropertyKeyPolicyKeysRes {
  return { data: [...data], status: 200 };
}
