import {
  Failure,
  head,
  logError,
  PropertyKeyPolicyEntryList,
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
  getPropertyKeyPoliciesApi,
  GetPropertyKeyPolicyEntriesRes,
  PropertyKeyPolicyEntryResource,
} from "../../../../lib/property-key-policies";
import { getClientFromSession } from "../../../../lib/vertex-api";
import withSession, { NextIronRequest } from "../../../../lib/with-session";

const EntriesPageSize = 200;

export async function handlePropertyKeyPolicyEntries(
  req: NextIronRequest,
  res: NextApiResponse<GetPropertyKeyPolicyEntriesRes | ErrorRes>
): Promise<void> {
  if (req.method === "GET") {
    const r = await get(req);
    return res.status(r.status).json(r);
  }

  return res.status(MethodNotAllowed.status).json(MethodNotAllowed);
}

export default withSession(handlePropertyKeyPolicyEntries);

async function get(
  req: NextIronRequest
): Promise<ErrorRes | GetPropertyKeyPolicyEntriesRes> {
  try {
    const id = head(req.query.id);
    if (id == null)
      return { message: "Property Key Policy ID required.", status: 400 };

    const c = getPropertyKeyPoliciesApi(
      await getClientFromSession(req.session)
    );

    const data = await fetchAllPages<
      PropertyKeyPolicyEntryResource,
      PropertyKeyPolicyEntryList
    >((pageCursor) =>
      c.listPropertyKeyPolicyEntries({
        filterPropertyKeyPolicyId: id,
        pageCursor,
        pageSize: EntriesPageSize,
      })
    );

    return { data, status: 200 };
  } catch (error) {
    const e = error as VertexError;
    const ae = error as AxiosError<Failure>;
    logError(e);
    return e.vertexError?.res
      ? toErrorRes({ failure: e.vertexError?.res })
      : ae.response?.data != null
      ? toErrorRes({ failure: ae.response.data })
      : ServerError;
  }
}
