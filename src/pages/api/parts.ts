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
  MethodNotAllowed,
  Res,
  ServerError,
  toErrorRes,
} from "../../lib/api";
import { getClientFromSession, makeCall } from "../../lib/vertex-api";
import withSession, { NextIronRequest } from "../../lib/with-session";

export type CreatePartReq = Pick<
  CreatePartRequestDataAttributes,
  "suppliedId" | "suppliedRevisionId" | "suppliedIterationId" | "indexMetadata"
> & {
  readonly fileId: string;
};

export type CreatePartRes = Pick<QueuedJobData, "id"> & Res;

export default withSession(async function handle(
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
});

async function get(req: NextIronRequest): Promise<ErrorRes | GetRes<PartData>> {
  try {
    const c = await getClientFromSession(req.session);
    const ps = head(req.query.pageSize);
    const pc = head(req.query.cursor);
    const sId = head(req.query.suppliedId);

    const { cursors, page } = await getPage(() =>
      c.parts.getParts({
        pageCursor: pc,
        pageSize: ps ? parseInt(ps, 10) : 10,
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
  if (!req.body) return BodyRequired;

  const b: DeleteReq = JSON.parse(req.body);
  if (!b.ids) return InvalidBody;

  const c = await getClientFromSession(req.session);
  await Promise.all(
    b.ids.map((id) => makeCall(() => c.parts.deletePart({ id })))
  );
  return { status: 200 };
}

async function create(req: NextIronRequest): Promise<ErrorRes | CreatePartRes> {
  const b: CreatePartReq = JSON.parse(req.body);
  if (!req.body) return InvalidBody;

  const c = await getClientFromSession(req.session);
  const res = await c.parts.createPart({
    createPartRequest: {
      data: {
        type: "part",
        attributes: {
          suppliedId: b.suppliedId,
          suppliedRevisionId: b.suppliedRevisionId,
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
  });

  return { status: 200, id: res.data.data.id };
}
