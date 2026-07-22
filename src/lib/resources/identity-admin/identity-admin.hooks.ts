// Developer-owned, read-only adapters for the sensitive identity/admin APIs.
import { getPage } from "@vertexvis/api-client-node";

import { ErrorRes, GetRes, Res } from "../../api/contracts";
import { requiredPathParam, type VertexRouteSpec } from "../../api/route";
import { NextIronRequest } from "../../with-session";

export interface IdentityAdminRecord {
  readonly attributes: Record<string, unknown>;
  readonly id: string;
  readonly type: string;
}

interface ListQuery {
  readonly cursor?: string;
  readonly filterIdpId?: string;
  readonly pageSize: number;
}

interface DetailInput {
  readonly id: string;
}

type ListResult = GetRes<IdentityAdminRecord> | ErrorRes;
type DetailResult = (IdentityAdminRecord & Res) | ErrorRes;

function scalar(
  req: NextIronRequest,
  name: string
): string | undefined | ErrorRes {
  const value = req.query[name];
  if (Array.isArray(value)) return { message: `Invalid ${name}.`, status: 400 };
  if (value == null) return undefined;
  const normalized = value.trim();
  return normalized === ""
    ? { message: `Invalid ${name}.`, status: 400 }
    : normalized;
}

function pageSize(req: NextIronRequest): number | ErrorRes {
  const value = req.query.pageSize;
  if (Array.isArray(value))
    return { message: "Invalid pageSize.", status: 400 };
  if (value == null) return 25;
  if (!/^\d+$/.test(value))
    return { message: "Invalid pageSize.", status: 400 };
  const parsed = Number.parseInt(value, 10);
  return parsed < 1
    ? { message: "Invalid pageSize.", status: 400 }
    : Math.min(parsed, 100);
}

function listQuery(
  req: NextIronRequest,
  allowsIdpFilter = false
): ListQuery | ErrorRes {
  const cursor = scalar(req, "cursor");
  if (typeof cursor !== "string" && cursor != null) return cursor;
  const size = pageSize(req);
  if (typeof size !== "number") return size;
  const filterIdpId = scalar(req, "filterIdpId");
  if (typeof filterIdpId !== "string" && filterIdpId != null)
    return filterIdpId;
  if (!allowsIdpFilter && filterIdpId != null) {
    return { message: "filterIdpId is not supported.", status: 400 };
  }
  return { cursor, filterIdpId, pageSize: size };
}

function detailInput(
  req: NextIronRequest,
  label: string
): DetailInput | ErrorRes {
  const id = requiredPathParam(req, "id", label);
  return typeof id === "string" && !Array.isArray(req.query.id)
    ? { id }
    : typeof id === "string"
    ? { message: `${label} is required.`, status: 400 }
    : id;
}

function asRecord(value: unknown): IdentityAdminRecord {
  const data = value as {
    readonly attributes?: Record<string, unknown>;
    readonly id: string;
    readonly type?: string;
  };
  return {
    attributes: data.attributes ?? {},
    id: data.id,
    type: data.type ?? "resource",
  };
}

function maskedWebhook(value: unknown): IdentityAdminRecord {
  const record = asRecord(value);
  const attributes = record.attributes;
  const rawUrl = typeof attributes.url === "string" ? attributes.url : "";
  let url = "Unavailable";
  try {
    const parsed = new URL(rawUrl);
    url = `${parsed.protocol}//${parsed.host}/…`;
  } catch {
    // Never return an untrusted endpoint value if it cannot be safely masked.
  }
  return {
    ...record,
    attributes: {
      created: attributes.created,
      status: attributes.status,
      topics: attributes.topics,
      url,
    },
  };
}

export const usersRouteSpec: VertexRouteSpec<undefined, ListQuery, ListResult> =
  {
    operations: {
      GET: {
        execute: async ({ client, query }) => {
          const { cursors, page } = await getPage(() =>
            client.users.listUsers({
              filterIdpId: query.filterIdpId,
              pageCursor: query.cursor,
              pageSize: query.pageSize,
            })
          );
          return { cursors, data: page.data.map(asRecord), status: 200 };
        },
        query: (req) => listQuery(req, true),
      },
    },
  };

export const userDetailRouteSpec: VertexRouteSpec<
  DetailInput,
  undefined,
  DetailResult
> = {
  operations: {
    GET: {
      execute: async ({ client, input }) => ({
        ...asRecord((await client.users.getUser({ id: input.id })).data.data),
        status: 200,
      }),
      parse: (req) => detailInput(req, "User ID"),
    },
  },
};

export const userGroupsRouteSpec: VertexRouteSpec<
  DetailInput,
  ListQuery,
  ListResult
> = {
  operations: {
    GET: {
      execute: async ({ client, input, query }) => {
        const { cursors, page } = await getPage(() =>
          client.users.getUserGroupsForUser({
            id: input.id,
            pageCursor: query.cursor,
            pageSize: query.pageSize,
          })
        );
        return { cursors, data: page.data.map(asRecord), status: 200 };
      },
      parse: (req) => detailInput(req, "User ID"),
      query: (req) => listQuery(req),
    },
  },
};

export const applicationsRouteSpec: VertexRouteSpec<
  undefined,
  ListQuery,
  ListResult
> = {
  operations: {
    GET: {
      execute: async ({ client, query }) => {
        const { cursors, page } = await getPage(() =>
          client.applications.getApplications({
            pageCursor: query.cursor,
            pageSize: query.pageSize,
          })
        );
        return { cursors, data: page.data.map(asRecord), status: 200 };
      },
      query: (req) => listQuery(req),
    },
  },
};

export const applicationDetailRouteSpec: VertexRouteSpec<
  DetailInput,
  undefined,
  DetailResult
> = {
  operations: {
    GET: {
      execute: async ({ client, input }) => ({
        ...asRecord(
          (await client.applications.getApplication({ id: input.id })).data.data
        ),
        status: 200,
      }),
      parse: (req) => detailInput(req, "Application ID"),
    },
  },
};

export const permissionGrantsRouteSpec: VertexRouteSpec<
  undefined,
  ListQuery,
  ListResult
> = {
  operations: {
    GET: {
      execute: async ({ client, query }) => {
        const { cursors, page } = await getPage(() =>
          client.permissionGrantsApi.listPermissionGrants({
            pageCursor: query.cursor,
            pageSize: query.pageSize,
          })
        );
        return { cursors, data: page.data.map(asRecord), status: 200 };
      },
      query: (req) => listQuery(req),
    },
  },
};

export const permissionGrantDetailRouteSpec: VertexRouteSpec<
  DetailInput,
  undefined,
  DetailResult
> = {
  operations: {
    GET: {
      execute: async ({ client, input }) => ({
        ...asRecord(
          (
            await client.permissionGrantsApi.getPermissionGrant({
              id: input.id,
            })
          ).data.data
        ),
        status: 200,
      }),
      parse: (req) => detailInput(req, "Permission grant ID"),
    },
  },
};

export const webhooksRouteSpec: VertexRouteSpec<
  undefined,
  ListQuery,
  ListResult
> = {
  operations: {
    GET: {
      execute: async ({ client, query }) => {
        const { cursors, page } = await getPage(() =>
          client.webhookSubscriptions.getWebhookSubscriptions({
            pageCursor: query.cursor,
            pageSize: query.pageSize,
          })
        );
        return { cursors, data: page.data.map(maskedWebhook), status: 200 };
      },
      query: (req) => listQuery(req),
    },
  },
};

export const webhookDetailRouteSpec: VertexRouteSpec<
  DetailInput,
  undefined,
  DetailResult
> = {
  operations: {
    GET: {
      execute: async ({ client, input }) => ({
        ...maskedWebhook(
          (
            await client.webhookSubscriptions.getWebhookSubscription({
              id: input.id,
            })
          ).data.data
        ),
        status: 200,
      }),
      parse: (req) => detailInput(req, "Webhook subscription ID"),
    },
  },
};

export const accountDetailRouteSpec: VertexRouteSpec<
  DetailInput,
  undefined,
  DetailResult
> = {
  operations: {
    GET: {
      execute: async ({ client, input }) => ({
        ...asRecord(
          (await client.accounts.getAccount({ id: input.id })).data.data
        ),
        status: 200,
      }),
      parse: (req) => detailInput(req, "Account ID"),
    },
  },
};

// UserGroupsApi.getUserGroup is incorrectly typed as AxiosResponse<void> in
// @vertexvis/api-client-node 0.44.0. It is intentionally not exposed here.
// OAuth2 endpoints return or consume credentials/challenges and are likewise
// intentionally absent from browser-accessible routes.
