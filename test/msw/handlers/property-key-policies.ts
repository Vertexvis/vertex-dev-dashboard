import { PropertyKeyPolicyMode } from "@vertexvis/api-client-node";

import type {
  GetPropertyKeyPolicyEntriesRes,
  GetPropertyKeyPolicyRes,
  PropertyKeyPolicyEntryResource,
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

export function propertyKeyPolicyEntry(overrides: {
  readonly id: string;
  readonly name: string;
  readonly policyId?: string;
}): PropertyKeyPolicyEntryResource {
  return {
    attributes: { key: { name: overrides.name } },
    id: overrides.id,
    relationships: {
      propertyKeyPolicy: {
        data: {
          id: overrides.policyId ?? "policy-1",
          type: "property-key-policy",
        },
      },
    },
    type: "property-key-policy-entry",
  };
}

export function propertyKeyPolicyEntriesRes({
  data,
}: {
  readonly data: readonly PropertyKeyPolicyEntryResource[];
}): GetPropertyKeyPolicyEntriesRes {
  return { data: [...data], status: 200 };
}
