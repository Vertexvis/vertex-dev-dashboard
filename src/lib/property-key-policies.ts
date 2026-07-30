import {
  PropertyKeyPoliciesApi,
  PropertyKeyPolicyEntryList,
  PropertyKeyPolicyList,
  PropertyKeyPolicyMode,
  VertexClient,
} from "@vertexvis/api-client-node";

import { GetRes, Res } from "./api";
import { Paged, toPage } from "./paging";

// Re-export for convenience so backend routes and the create dialog can share
// the mode contract. `PropertyKeyPolicyMode` is both a type and a runtime const
// (`{ Allowlist: "allowlist", Denylist: "denylist" }`).
export { PropertyKeyPolicyMode };

export type PropertyKeyPolicyResource = PropertyKeyPolicyList["data"][number];
export type PropertyKeyPolicyPageRes = GetRes<PropertyKeyPolicyResource>;

export type PropertyKeyPolicy = PropertyKeyPolicyResource["attributes"] &
  Pick<PropertyKeyPolicyResource, "id">;

export type PropertyKeyPolicyEntryResource =
  PropertyKeyPolicyEntryList["data"][number];

/**
 * Flattened dashboard model for a single property-key-policy entry.
 *
 * The upstream entry carries its own `id` plus the case-sensitive metadata key
 * name (`attributes.key.name`). We surface both so the UI can list entries and,
 * in a future iteration, target a specific entry for deletion.
 */
export interface PropertyKeyPolicyEntry {
  readonly id: string;
  readonly name: string;
}

export type GetPropertyKeyPolicyRes = Res & {
  readonly data: PropertyKeyPolicyResource;
};

export type GetPropertyKeyPolicyEntriesRes = Res & {
  readonly data: PropertyKeyPolicyEntryResource[];
};

/**
 * Create request body shared by the POST API route and the create dialog.
 *
 * `keys` are metadata property keys that are case-sensitive and must be
 * submitted verbatim (no case normalization).
 */
export interface CreatePropertyKeyPolicyReq {
  readonly name: string;
  readonly suppliedId?: string;
  readonly mode: PropertyKeyPolicyMode;
  readonly keys: string[];
}

/**
 * Response for a successful policy creation (HTTP 201).
 *
 * The policy is always created first, then entries are upserted. Per product
 * decision, if the entries upsert fails the created policy is KEPT (not rolled
 * back) and `entriesError` carries a human-readable message so the UI can warn
 * the user that the policy exists but its keys were not added.
 */
export type CreatePropertyKeyPolicyRes = Res & {
  readonly data: PropertyKeyPolicyResource;
  readonly entriesError?: string;
};

export type DeletePropertyKeyPoliciesRes = Res & {
  readonly deletedIds: string[];
};

export type PartialDeletePropertyKeyPoliciesRes =
  DeletePropertyKeyPoliciesRes & {
    readonly failedIds: string[];
    readonly message: string;
  };

export function toPropertyKeyPolicy(
  data: PropertyKeyPolicyResource
): PropertyKeyPolicy {
  return { ...data.attributes, id: data.id };
}

export function toPropertyKeyPolicyPage(
  res: PropertyKeyPolicyPageRes
): Paged<PropertyKeyPolicy> {
  return toPage<
    PropertyKeyPolicyResource,
    PropertyKeyPolicyResource["attributes"]
  >(res);
}

export function toPropertyKeyPolicyEntry(
  data: PropertyKeyPolicyEntryResource
): PropertyKeyPolicyEntry {
  return { id: data.id, name: data.attributes.key.name };
}

export function getPropertyKeyPoliciesApi(
  client: VertexClient
): PropertyKeyPoliciesApi {
  return new PropertyKeyPoliciesApi(
    client.config,
    undefined,
    client.axiosInstance
  );
}
