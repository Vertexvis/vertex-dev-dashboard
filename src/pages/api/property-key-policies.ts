import {
  FilterExpression,
  getPage,
  head,
  logError,
  PropertyKeyPolicyList,
  VertexError,
} from "@vertexvis/api-client-node";
import { AxiosResponse } from "axios";
import { NextApiResponse } from "next";

import {
  BodyRequired,
  DeleteReq,
  ErrorRes,
  InvalidBody,
  isErrorFailure,
  MethodNotAllowed,
  ServerError,
  toErrorRes,
} from "../../lib/api";
import {
  CreatePropertyKeyPolicyReq,
  CreatePropertyKeyPolicyRes,
  DeletePropertyKeyPoliciesRes,
  getPropertyKeyPoliciesApi,
  PartialDeletePropertyKeyPoliciesRes,
  PropertyKeyPolicyMode,
  PropertyKeyPolicyPageRes,
} from "../../lib/property-key-policies";
import { setFilterExpression } from "../../lib/query-filters";
import { parsePositiveQueryInt } from "../../lib/query-params";
import { getClientFromSession, makeCall } from "../../lib/vertex-api";
import withSession, { NextIronRequest } from "../../lib/with-session";

export async function handlePropertyKeyPolicies(
  req: NextIronRequest,
  res: NextApiResponse<
    | PropertyKeyPolicyPageRes
    | CreatePropertyKeyPolicyRes
    | DeletePropertyKeyPoliciesRes
    | ErrorRes
  >
): Promise<void> {
  if (req.method === "GET") {
    const r = await get(req);
    return res.status(r.status).json(r);
  }

  if (req.method === "POST") {
    const r = await create(req);
    return res.status(r.status).json(r);
  }

  if (req.method === "DELETE") {
    const r = await del(req);
    return res.status(r.status).json(r);
  }

  return res.status(MethodNotAllowed.status).json(MethodNotAllowed);
}

export default withSession(handlePropertyKeyPolicies);

async function get(
  req: NextIronRequest
): Promise<ErrorRes | PropertyKeyPolicyPageRes> {
  try {
    const client = await getClientFromSession(req.session);
    const ps = head(req.query.pageSize);
    const pc = head(req.query.cursor);
    const suppliedId = head(req.query.suppliedId);

    const query = new URLSearchParams();
    if (pc != null) query.set("page[cursor]", pc);
    query.set("page[size]", parsePositiveQueryInt(ps, 10).toString());
    setFilterExpression(
      query,
      "suppliedId",
      suppliedId != null
        ? ({ contains: suppliedId } satisfies FilterExpression)
        : undefined
    );

    const { cursors, page } = await getPage(
      (): Promise<AxiosResponse<PropertyKeyPolicyList>> =>
        client.axiosInstance.get<PropertyKeyPolicyList>(
          `${client.config.basePath}/property-key-policies?${query.toString()}`,
          {
            headers: {
              Accept: "application/vnd.api+json",
              Authorization: `Bearer ${client.token.access_token}`,
            },
          }
        )
    );
    return {
      cursors,
      data: page.data,
      status: 200,
    };
  } catch (error) {
    const e = error as VertexError;
    logError(e);
    return e.vertexError?.res
      ? toErrorRes({ failure: e.vertexError?.res })
      : ServerError;
  }
}

async function create(
  req: NextIronRequest
): Promise<ErrorRes | CreatePropertyKeyPolicyRes> {
  if (!req.body) return BodyRequired;

  const body = parseCreatePropertyKeyPolicyReq(req.body);
  if (body == null) return InvalidBody;

  try {
    const client = await getClientFromSession(req.session);
    const c = getPropertyKeyPoliciesApi(client);

    const created = await makeCall(() =>
      c.createPropertyKeyPolicy({
        createPropertyKeyPolicyRequest: {
          data: {
            type: "property-key-policy",
            attributes: {
              name: body.name,
              ...(body.suppliedId != null
                ? { suppliedId: body.suppliedId }
                : {}),
              mode: body.mode,
            },
          },
        },
      })
    );
    if (isErrorFailure(created)) return toErrorRes({ failure: created });

    const entries = await makeCall(() =>
      c.upsertPropertyKeyPolicyEntries({
        id: created.data.id,
        upsertPropertyKeyPolicyEntriesRequest: {
          data: body.keys.map((name) => ({ name })),
        },
      })
    );
    if (isErrorFailure(entries)) {
      return {
        data: created.data,
        entriesError: toErrorRes({ failure: entries }).message,
        status: 201,
      };
    }

    return { data: created.data, status: 201 };
  } catch (error) {
    const e = error as VertexError;
    logError(e);
    return e.vertexError?.res
      ? toErrorRes({ failure: e.vertexError?.res })
      : ServerError;
  }
}

async function del(
  req: NextIronRequest
): Promise<
  ErrorRes | DeletePropertyKeyPoliciesRes | PartialDeletePropertyKeyPoliciesRes
> {
  if (!req.body) return BodyRequired;

  let ids: unknown;
  try {
    const parsed = (
      typeof req.body === "string" ? JSON.parse(req.body) : req.body
    ) as Partial<DeleteReq>;
    ids = parsed?.ids;
  } catch {
    return InvalidBody;
  }
  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    !ids.every((id) => typeof id === "string")
  )
    return InvalidBody;

  try {
    const c = getPropertyKeyPoliciesApi(
      await getClientFromSession(req.session)
    );
    const results = await Promise.all(
      ids.map((id) => makeCall(() => c.deletePropertyKeyPolicy({ id })))
    );
    const deletedIds = ids.filter(
      (_, index) => !isErrorFailure(results[index])
    );
    const failedIds = ids.filter((_, index) => isErrorFailure(results[index]));
    if (failedIds.length > 0) {
      const failure = results.find(isErrorFailure);
      if (failure == null) return ServerError;
      if (deletedIds.length === 0) return toErrorRes({ failure });

      const error = toErrorRes({ failure });
      return {
        deletedIds,
        failedIds,
        message: error.message,
        status: 207,
      };
    }

    return { deletedIds, status: 200 };
  } catch (error) {
    const e = error as VertexError;
    logError(e);
    return e.vertexError?.res
      ? toErrorRes({ failure: e.vertexError?.res })
      : ServerError;
  }
}

function parseCreatePropertyKeyPolicyReq(
  body: unknown
): CreatePropertyKeyPolicyReq | undefined {
  try {
    const parsed = (
      typeof body === "string" ? JSON.parse(body) : body
    ) as Partial<CreatePropertyKeyPolicyReq>;

    const name = parsed.name;
    if (typeof name !== "string" || name.trim() === "") return undefined;
    const trimmedName = name.trim();

    const mode = parsed.mode;
    if (!isPropertyKeyPolicyMode(mode)) return undefined;

    const keys = parsed.keys;
    if (!Array.isArray(keys) || keys.length === 0) return undefined;
    // Submit keys VERBATIM (case-sensitive, no normalization). Reject only
    // non-string or whitespace-only entries.
    if (keys.some((key) => typeof key !== "string" || key.trim() === ""))
      return undefined;

    const suppliedId =
      typeof parsed.suppliedId === "string" && parsed.suppliedId.trim() !== ""
        ? parsed.suppliedId.trim()
        : undefined;

    return suppliedId == null
      ? { keys, mode, name: trimmedName }
      : { keys, mode, name: trimmedName, suppliedId };
  } catch {
    return undefined;
  }
}

function isPropertyKeyPolicyMode(
  value: unknown
): value is PropertyKeyPolicyMode {
  return (
    value === PropertyKeyPolicyMode.Allowlist ||
    value === PropertyKeyPolicyMode.Denylist
  );
}
