import {
  getPage,
  logError,
  PropertyKeyPolicyData,
  PropertyKeyPolicyList,
  VertexError,
} from "@vertexvis/api-client-node";
import { AxiosResponse } from "axios";
import { NextApiResponse } from "next";

import {
  ErrorRes,
  GetRes,
  MethodNotAllowed,
  ServerError,
  toErrorRes,
} from "../../lib/api";
import { getClientFromSession } from "../../lib/vertex-api";
import withSession, { NextIronRequest } from "../../lib/with-session";

export async function handlePropertyKeyPolicies(
  req: NextIronRequest,
  res: NextApiResponse<GetRes<PropertyKeyPolicyData> | ErrorRes>
): Promise<void> {
  if (req.method === "GET") {
    const r = await get(req);
    return res.status(r.status).json(r);
  }

  return res.status(MethodNotAllowed.status).json(MethodNotAllowed);
}

export default withSession(handlePropertyKeyPolicies);

async function get(
  req: NextIronRequest
): Promise<ErrorRes | GetRes<PropertyKeyPolicyData>> {
  try {
    const c = await getClientFromSession(req.session);
    const { cursors, page } = await getPage(
      () =>
        c.axiosInstance.get(
          `${c.config.basePath}/property-key-policies?page[size]=100`,
          {
            headers: {
              Accept: "application/vnd.api+json",
              Authorization: `Bearer ${c.token.access_token}`,
            },
          }
        ) as Promise<AxiosResponse<PropertyKeyPolicyList>>
    );
    return { cursors, data: page.data, status: 200 };
  } catch (error) {
    const e = error as VertexError;
    logError(e);
    return e.vertexError?.res
      ? toErrorRes({ failure: e.vertexError?.res })
      : ServerError;
  }
}
