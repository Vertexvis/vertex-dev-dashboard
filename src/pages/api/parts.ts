import {
  CreatePartRequestDataAttributes,
  FileRelationshipDataTypeEnum,
  getPage,
  head,
  logError,
  PartData,
  QueuedJobData,
  VertexError,
} from "@vertexvis/api-client-node";
import { NextApiResponse } from "next";

import {
  BodyRequired,
  DeleteReq,
  ErrorRes,
  GetRes,
  InvalidBody,
  isErrorFailure,
  MethodNotAllowed,
  Res,
  ServerError,
  toErrorRes,
} from "../../lib/api";
import { parsePositiveQueryInt } from "../../lib/query-params";
import { getClientFromSession, makeCall } from "../../lib/vertex-api";
import withSession, { NextIronRequest } from "../../lib/with-session";

export type CreatePartReq = Pick<
  CreatePartRequestDataAttributes,
  "suppliedId" | "suppliedRevisionId" | "suppliedIterationId" | "indexMetadata"
> & {
  readonly fileId: string;
};

export type CreatePartRes = Pick<QueuedJobData, "id"> & Res;

export async function handleParts(
  req: NextIronRequest,
  res: NextApiResponse<GetRes<PartData> | Res | ErrorRes>
): Promise<void> {
  if (req.method === "GET") {
    const r = await get(req);
    return res.status(r.status).json(r);
  }

  if (req.method === "DELETE") {
    const r = await del(req);
    return res.status(r.status).json(r);
  }

  if (req.method === "POST") {
    const r = await create(req);
    return res.status(r.status).json(r);
  }

  return res.status(MethodNotAllowed.status).json(MethodNotAllowed);
}

export default withSession(handleParts);

async function get(req: NextIronRequest): Promise<ErrorRes | GetRes<PartData>> {
  try {
    const c = await getClientFromSession(req.session);
    const ps = head(req.query.pageSize);
    const pc = head(req.query.cursor);
    const sId = head(req.query.suppliedId);

    const { cursors, page } = await getPage(() =>
      c.parts.getParts({
        pageCursor: pc,
        pageSize: parsePositiveQueryInt(ps, 10),
        filterSuppliedId: sId,
      })
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

async function del(req: NextIronRequest): Promise<ErrorRes | Res> {
  const b = parseDeleteReq(req.body);
  if (b == null) return req.body == null ? BodyRequired : InvalidBody;

  try {
    const c = await getClientFromSession(req.session);
    const results = await Promise.all(
      b.ids.map((id) => makeCall(() => c.parts.deletePart({ id })))
    );
    const failure = results.find(isErrorFailure);
    return failure == null ? { status: 200 } : toErrorRes({ failure });
  } catch (error) {
    return toRouteError(error);
  }
}

async function create(req: NextIronRequest): Promise<ErrorRes | CreatePartRes> {
  const b = parseCreatePartReq(req.body);
  if (b == null) return req.body == null ? BodyRequired : InvalidBody;

  try {
    const c = await getClientFromSession(req.session);
    const result = await makeCall(() =>
      c.parts.createPart({
        createPartRequest: {
          data: {
            type: "part",
            attributes: {
              suppliedId: b.suppliedId,
              suppliedRevisionId: b.suppliedRevisionId,
              suppliedIterationId: b.suppliedIterationId,
              indexMetadata: b.indexMetadata,
            },
            relationships: {
              source: {
                data: {
                  type: FileRelationshipDataTypeEnum.File,
                  id: b.fileId,
                },
              },
            },
          },
        },
      })
    );
    if (isErrorFailure(result)) return toErrorRes({ failure: result });

    return { status: 200, id: result.data.id };
  } catch (error) {
    return toRouteError(error);
  }
}

function parseDeleteReq(body: unknown): DeleteReq | undefined {
  const parsed = parseJsonObject(body);
  const ids = parsed?.ids;
  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    ids.some((id) => typeof id !== "string" || id.trim() === "")
  )
    return undefined;

  return { ids: [...new Set(ids.map((id) => id.trim()))] };
}

function parseCreatePartReq(body: unknown): CreatePartReq | undefined {
  const parsed = parseJsonObject(body);
  if (parsed == null || typeof parsed.fileId !== "string") return undefined;

  const fileId = parsed.fileId.trim();
  if (fileId === "") return undefined;

  const optionalStringFields = [
    "suppliedId",
    "suppliedRevisionId",
    "suppliedIterationId",
  ] as const;
  if (
    optionalStringFields.some(
      (field) => parsed[field] != null && typeof parsed[field] !== "string"
    ) ||
    (parsed.indexMetadata != null && typeof parsed.indexMetadata !== "boolean")
  )
    return undefined;

  return {
    fileId,
    ...(typeof parsed.suppliedId === "string"
      ? { suppliedId: parsed.suppliedId }
      : {}),
    ...(typeof parsed.suppliedRevisionId === "string"
      ? { suppliedRevisionId: parsed.suppliedRevisionId }
      : {}),
    ...(typeof parsed.suppliedIterationId === "string"
      ? { suppliedIterationId: parsed.suppliedIterationId }
      : {}),
    ...(typeof parsed.indexMetadata === "boolean"
      ? { indexMetadata: parsed.indexMetadata }
      : {}),
  };
}

function parseJsonObject(body: unknown): Record<string, unknown> | undefined {
  if (body == null) return undefined;

  try {
    const parsed =
      typeof body === "string" ? (JSON.parse(body) as unknown) : body;
    return typeof parsed === "object" &&
      parsed != null &&
      !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function toRouteError(error: unknown): ErrorRes {
  const e = error as VertexError;
  logError(e);
  return e.vertexError?.res
    ? toErrorRes({ failure: e.vertexError.res })
    : ServerError;
}
