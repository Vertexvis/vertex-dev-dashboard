// developer-owned: resource-scoped Property Entries list lifecycle hooks.
import { getPage, PropertyEntryData } from "@vertexvis/api-client-node";

import { ErrorRes, GetRes } from "../../api/contracts";
import { type VertexRouteSpec } from "../../api/route";
import { NextIronRequest } from "../../with-session";

const propertyTargetTypes = new Set([
  "property-set",
  "part-instance",
  "part-revision",
  "scene-item",
]);

interface PropertyEntriesQuery {
  readonly cursor?: string;
  readonly pageSize: number;
  readonly resourceId: string;
  readonly resourceType: string;
}

type PropertyEntriesResult = GetRes<PropertyEntryData> | ErrorRes;

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

function parseQuery(req: NextIronRequest): PropertyEntriesQuery | ErrorRes {
  const resourceId = scalar(req, "resourceId");
  const resourceType = scalar(req, "resourceType");
  if (typeof resourceId !== "string") {
    return resourceId ?? { message: "Resource ID is required.", status: 400 };
  }
  if (typeof resourceType !== "string") {
    return (
      resourceType ?? {
        message: "Resource type is required.",
        status: 400,
      }
    );
  }
  if (!propertyTargetTypes.has(resourceType)) {
    return { message: "Invalid resource type.", status: 400 };
  }
  const cursor = scalar(req, "cursor");
  if (typeof cursor !== "string" && cursor != null) return cursor;
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
  return {
    cursor,
    pageSize: Math.min(pageSize, 100),
    resourceId,
    resourceType,
  };
}

export const propertyEntriesCollectionRouteSpec: VertexRouteSpec<
  undefined,
  PropertyEntriesQuery,
  PropertyEntriesResult
> = {
  operations: {
    GET: {
      execute: async ({ client, query }) => {
        const { cursors, page } = await getPage(() =>
          client.propertyEntries.getPropertyEntries({
            filterResourceId: query.resourceId,
            filterResourceType: query.resourceType,
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
