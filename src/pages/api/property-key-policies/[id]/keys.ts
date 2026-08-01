import {
  Failure,
  head,
  logError,
  VertexError,
} from "@vertexvis/api-client-node";
import { AxiosError } from "axios";
import { NextApiResponse } from "next";

import {
  ErrorRes,
  MethodNotAllowed,
  ServerError,
  toErrorRes,
} from "../../../../lib/api";
import { fetchAllPages } from "../../../../lib/paging";
import {
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
  res: NextApiResponse<GetPropertyKeyPolicyKeysRes | ErrorRes>
): Promise<void> {
  if (req.method === "GET") {
    const r = await get(req);
    return res.status(r.status).json(r);
  }

  return res.status(MethodNotAllowed.status).json(MethodNotAllowed);
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
    if (e.vertexError?.res != null)
      return toErrorRes({ failure: e.vertexError.res });
    if (ae.response?.data != null)
      return toErrorRes({ failure: ae.response.data });
    return ServerError;
  }
}
