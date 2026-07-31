import {
  Failure,
  head,
  logError,
  VertexError,
} from "@vertexvis/api-client-node";
import { AxiosError } from "axios";
import { NextApiResponse } from "next";

import {
  BodyRequired,
  ErrorRes,
  InvalidBody,
  MethodNotAllowed,
  ServerError,
  toErrorRes,
} from "../../../../lib/api";
import { fetchAllPages } from "../../../../lib/paging";
import {
  AddPropertyKeyPolicyKeysReq,
  AddPropertyKeyPolicyKeysRes,
  DeletePropertyKeyPolicyKeysReq,
  DeletePropertyKeyPolicyKeysRes,
  GetPropertyKeyPolicyKeysRes,
  PropertyKeyPolicyKeyResource,
} from "../../../../lib/property-key-policies";
import { getClientFromSession } from "../../../../lib/vertex-api";
import withSession, { NextIronRequest } from "../../../../lib/with-session";

const KeysPageSize = 200;

interface PropertyKeyPolicyKeyList {
  readonly data: PropertyKeyPolicyKeyResource[];
  readonly links: {
    readonly next?: { readonly href: string };
    readonly self?: { readonly href: string };
  };
}

export async function handlePropertyKeyPolicyKeys(
  req: NextIronRequest,
  res: NextApiResponse<
    | GetPropertyKeyPolicyKeysRes
    | AddPropertyKeyPolicyKeysRes
    | DeletePropertyKeyPolicyKeysRes
    | ErrorRes
  >
): Promise<void> {
  if (req.method === "GET") {
    const r = await get(req);
    return res.status(r.status).json(r);
  }

  if (req.method === "POST") {
    const r = await add(req);
    return res.status(r.status).json(r);
  }

  if (req.method === "DELETE") {
    const r = await del(req);
    return res.status(r.status).json(r);
  }

  return res.status(MethodNotAllowed.status).json(MethodNotAllowed);
}

async function add(
  req: NextIronRequest
): Promise<ErrorRes | AddPropertyKeyPolicyKeysRes> {
  const id = head(req.query.id);
  if (id == null)
    return { message: "Property Key Policy ID required.", status: 400 };
  if (!req.body) return BodyRequired;

  const keys = parseKeys(req.body, "keys");
  if (keys == null) return InvalidBody;

  try {
    const client = await getClientFromSession(req.session);
    await client.axiosInstance.post(
      `${client.config.basePath}/property-key-policies/${encodeURIComponent(
        id
      )}/keys`,
      { data: keys.map((name) => ({ name })) },
      {
        headers: {
          Accept: "application/vnd.api+json",
          Authorization: `Bearer ${client.token.access_token}`,
          "Content-Type": "application/vnd.api+json",
        },
      }
    );
    return { status: 201 };
  } catch (error) {
    return errorRes(error);
  }
}

async function del(
  req: NextIronRequest
): Promise<ErrorRes | DeletePropertyKeyPolicyKeysRes> {
  const id = head(req.query.id);
  if (id == null)
    return { message: "Property Key Policy ID required.", status: 400 };
  if (!req.body) return BodyRequired;

  const ids = parseKeys(req.body, "ids");
  if (ids == null) return InvalidBody;

  try {
    const client = await getClientFromSession(req.session);
    await client.axiosInstance.delete(
      `${client.config.basePath}/property-key-policies/${encodeURIComponent(
        id
      )}/keys`,
      {
        headers: {
          Accept: "application/vnd.api+json",
          Authorization: `Bearer ${client.token.access_token}`,
        },
        params: { "filter[id]": ids.join(",") },
      }
    );
    return { status: 200 };
  } catch (error) {
    return errorRes(error);
  }
}

function parseKeys(
  body: unknown,
  property: "ids" | "keys"
): string[] | undefined {
  try {
    const parsed = (typeof body === "string" ? JSON.parse(body) : body) as
      | Partial<AddPropertyKeyPolicyKeysReq>
      | Partial<DeletePropertyKeyPolicyKeysReq>;
    const values = (parsed as Record<string, unknown>)[property];
    if (
      !Array.isArray(values) ||
      values.length === 0 ||
      values.some((value) => typeof value !== "string" || value.trim() === "")
    )
      return undefined;
    return values;
  } catch {
    return undefined;
  }
}

function errorRes(error: unknown): ErrorRes {
  const e = error as VertexError;
  const ae = error as AxiosError<Failure>;
  logError(e);
  return e.vertexError?.res
    ? toErrorRes({ failure: e.vertexError.res })
    : ae.response?.data != null
    ? toErrorRes({ failure: ae.response.data })
    : ServerError;
}

export default withSession(handlePropertyKeyPolicyKeys);

async function get(
  req: NextIronRequest
): Promise<ErrorRes | GetPropertyKeyPolicyKeysRes> {
  try {
    const id = head(req.query.id);
    if (id == null)
      return { message: "Property Key Policy ID required.", status: 400 };

    const client = await getClientFromSession(req.session);
    const path = `${
      client.config.basePath
    }/property-key-policies/${encodeURIComponent(id)}/keys`;
    const data = await fetchAllPages<
      PropertyKeyPolicyKeyResource,
      PropertyKeyPolicyKeyList
    >((pageCursor) =>
      client.axiosInstance.get<PropertyKeyPolicyKeyList>(path, {
        headers: {
          Accept: "application/vnd.api+json",
          Authorization: `Bearer ${client.token.access_token}`,
        },
        params: {
          ...(pageCursor != null ? { "page[cursor]": pageCursor } : {}),
          "page[size]": KeysPageSize,
        },
      })
    );

    return { data, status: 200 };
  } catch (error) {
    const e = error as VertexError;
    const ae = error as AxiosError<Failure>;
    logError(e);
    return e.vertexError?.res
      ? toErrorRes({ failure: e.vertexError.res })
      : ae.response?.data != null
      ? toErrorRes({ failure: ae.response.data })
      : ServerError;
  }
}
