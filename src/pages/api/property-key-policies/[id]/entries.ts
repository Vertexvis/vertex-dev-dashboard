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
  GetPropertyKeyPolicyEntriesRes,
  PropertyKeyPolicyEntryResource,
} from "../../../../lib/property-key-policies";
import { getClientFromSession, makeCall } from "../../../../lib/vertex-api";
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

    const data: PropertyKeyPolicyEntryResource[] = [];
    let cursor: string | undefined;
    do {
      // eslint-disable-next-line no-await-in-loop
      const page = await makeCall(() =>
        c.listPropertyKeyPolicyEntries({
          filterPropertyKeyPolicyId: id,
          pageCursor: cursor,
          pageSize: EntriesPageSize,
        })
      );
      if (isErrorFailure(page)) return toErrorRes({ failure: page });

      data.push(...page.data);
      cursor = nextCursor(page.links.next?.href);
    } while (cursor != null);

    return { data, status: 200 };
  } catch (error) {
    const e = error as VertexError;
    logError(e);
    return e.vertexError?.res
      ? toErrorRes({ failure: e.vertexError?.res })
      : ServerError;
  }
}

function nextCursor(href?: string): string | undefined {
  if (href == null) return undefined;

  try {
    return new URL(href).searchParams.get("page[cursor]") ?? undefined;
  } catch {
    return undefined;
  }
}
