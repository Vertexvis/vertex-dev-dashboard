import {
  FileRelationshipDataTypeEnum,
  getPage,
  head,
  logError,
  PartData,
} from "@vertexvis/api-client-node";
import { NextApiRequest, NextApiResponse } from "next";

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
import { getClient, makeCall } from "../../lib/vertex-api";

export interface GetPartsRes extends Res {
  readonly cursor?: string;
  readonly data: PartData[];
}

export interface CreatePartBody {
  suppliedId: string;
  suppliedRevisionId: string;
  fileId: string;
  indexMetadata?: boolean;
}

export interface CreatePartRes extends Res {
  queuedTranslationId: string;
}

export default async function handle(
  req: NextApiRequest,
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

async function get(req: NextApiRequest): Promise<ErrorRes | GetRes<PartData>> {
  try {
    const c = await getClient();
    const ps = head(req.query.pageSize);
    const pc = head(req.query.cursor);
    const sId = head(req.query.suppliedId);

    const r = await getPage(() =>
      c.parts.getParts({
        pageCursor: pc,
        pageSize: ps ? parseInt(ps, 10) : 10,
        filterSuppliedId: sId,
      })
    );
    return { cursor: r.cursor, data: r.page.data, status: 200 };
  } catch (error) {
    logError(error);
    return error.vertexError?.res
      ? toErrorRes(error.vertexError?.res)
      : ServerError;
  }
}

async function del(req: NextApiRequest): Promise<ErrorRes | Res> {
  if (!req.body) return BodyRequired;

  const b: DeleteReq = JSON.parse(req.body);
  if (!b.ids) return InvalidBody;

  await Promise.all(
    b.ids.map((id) => makeCall((c) => c.parts.deletePart({ id })))
  );
  return { status: 200 };
}

async function create(req: NextApiRequest): Promise<ErrorRes | CreatePartRes> {
  const b: CreatePartBody = JSON.parse(req.body);
  if (!req.body) return { message: "Body required.", status: 400 };

  const c = await getClient();
  const res = await c.parts.createPart({
    createPartRequest: {
      data: {
        type: "part",
        attributes: {
          suppliedId: b.suppliedId,
          suppliedRevisionId: b.suppliedRevisionId,
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

  return { status: 200, queuedTranslationId: res.data.data.id };
}
