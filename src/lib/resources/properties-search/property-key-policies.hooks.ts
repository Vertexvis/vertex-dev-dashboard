// developer-owned: typed Property Key Policies lifecycle hooks.
import {
  getPage,
  PropertyKeyPoliciesApi,
  PropertyKeyPolicyData,
  type VertexClient,
} from "@vertexvis/api-client-node";

import { ErrorRes, GetRes } from "../../api/contracts";
import { type VertexRouteSpec } from "../../api/route";
import { NextIronRequest } from "../../with-session";

interface PoliciesQuery {
  readonly cursor?: string;
  readonly pageSize: number;
}

type PoliciesResult = GetRes<PropertyKeyPolicyData> | ErrorRes;

/**
 * The SDK's VertexClient facade currently omits PropertyKeyPoliciesApi. Keep
 * this server-only adapter coupled to the authenticated client's configured
 * token refresh and Axios instance; never reconstruct credentials or proxy.
 */
export function propertyKeyPoliciesFromClient(
  client: Pick<VertexClient, "axiosInstance" | "config">
): PropertyKeyPoliciesApi {
  return new PropertyKeyPoliciesApi(
    client.config,
    undefined,
    client.axiosInstance
  );
}

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

function parseQuery(req: NextIronRequest): PoliciesQuery | ErrorRes {
  const cursor = scalar(req, "cursor");
  const suppliedId = scalar(req, "suppliedId");
  const operator = scalar(req, "operator");
  if (typeof cursor !== "string" && cursor != null) return cursor;
  if (typeof suppliedId !== "string" && suppliedId != null) return suppliedId;
  if (typeof operator !== "string" && operator != null) return operator;
  if (suppliedId != null || operator != null) {
    return {
      message: "Policy filtering is not supported by this SDK version.",
      status: 400,
    };
  }
  const pageSizeValue = req.query.pageSize;
  if (Array.isArray(pageSizeValue))
    return { message: "Invalid pageSize.", status: 400 };
  const pageSize =
    pageSizeValue == null ? 25 : Number.parseInt(pageSizeValue, 10);
  if (
    !Number.isInteger(pageSize) ||
    pageSize < 1 ||
    (pageSizeValue != null && !/^\d+$/.test(pageSizeValue))
  ) {
    return { message: "Invalid pageSize.", status: 400 };
  }
  return { cursor, pageSize: Math.min(pageSize, 100) };
}

export const propertyKeyPoliciesCollectionRouteSpec: VertexRouteSpec<
  undefined,
  PoliciesQuery,
  PoliciesResult
> = {
  operations: {
    GET: {
      execute: async ({ client, query }) => {
        const { cursors, page } = await getPage(() =>
          propertyKeyPoliciesFromClient(client).listPropertyKeyPolicies({
            pageCursor: query.cursor,
            pageSize: query.pageSize,
          })
        );
        return { cursors, data: page.data, status: 200 };
      },
      query: parseQuery,
    },
  },
};
