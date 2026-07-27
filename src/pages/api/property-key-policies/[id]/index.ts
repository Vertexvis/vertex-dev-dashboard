import { head, logError, VertexError } from "@vertexvis/api-client-node";
import { NextApiResponse } from "next";

import {
  ErrorRes,
  isErrorFailure,
  MethodNotAllowed,
  ServerError,
  toErrorRes,
} from "../../../../lib/api";
import {
  getPropertyKeyPoliciesApi,
  GetPropertyKeyPolicyRes,
} from "../../../../lib/property-key-policies";
import { getClientFromSession, makeCall } from "../../../../lib/vertex-api";
import withSession, { NextIronRequest } from "../../../../lib/with-session";

export async function handlePropertyKeyPolicy(
  req: NextIronRequest,
  res: NextApiResponse<GetPropertyKeyPolicyRes | ErrorRes>
): Promise<void> {
  if (req.method === "GET") {
    const r = await get(req);
    return res.status(r.status).json(r);
  }

  return res.status(MethodNotAllowed.status).json(MethodNotAllowed);
}

export default withSession(handlePropertyKeyPolicy);

async function get(
  req: NextIronRequest
): Promise<ErrorRes | GetPropertyKeyPolicyRes> {
  try {
    const id = head(req.query.id);
    if (id == null)
      return { message: "Property Key Policy ID required.", status: 400 };

    const c = getPropertyKeyPoliciesApi(
      await getClientFromSession(req.session)
    );
    const res = await makeCall(() => c.getPropertyKeyPolicy({ id }));
    if (isErrorFailure(res)) return toErrorRes({ failure: res });

    return { data: res.data, status: 200 };
  } catch (error) {
    const e = error as VertexError;
    logError(e);
    return e.vertexError?.res
      ? toErrorRes({ failure: e.vertexError?.res })
      : ServerError;
  }
}
