import { createResourceClient } from "../../api/client";
import { IdentityAdminRecord } from "./identity-admin.hooks";

export interface IdentityAdminListQuery
  extends Record<string, string | number | undefined> {
  readonly cursor?: string;
  readonly filterIdpId?: string;
  readonly pageSize?: number;
}

function readOnlyResource(path: string) {
  return createResourceClient<
    unknown,
    IdentityAdminListQuery,
    never,
    never,
    IdentityAdminRecord
  >({
    path,
    supports: ["get", "list"],
  });
}

export const identityAdminUsersClient = readOnlyResource(
  "/api/identity-admin/users"
);
export const identityAdminApplicationsClient = readOnlyResource(
  "/api/identity-admin/applications"
);
export const identityAdminPermissionGrantsClient = readOnlyResource(
  "/api/identity-admin/permission-grants"
);
export const identityAdminWebhooksClient = readOnlyResource(
  "/api/identity-admin/webhook-subscriptions"
);
