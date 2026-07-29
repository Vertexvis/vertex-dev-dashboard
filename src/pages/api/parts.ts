import {
  CreatePartRequestDataAttributes,
  FileRelationshipDataTypeEnum,
  getPage,
  head,
  PartData,
  QueuedJobData,
} from "@vertexvis/api-client-node";

import {
  BodyRequired,
  DeleteReq,
  ErrorRes,
  GetRes,
  InvalidBody,
  Res,
} from "../../lib/api";
import { methodRouter } from "../../lib/api-handler";
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

export default withSession(
  methodRouter({ GET: get, DELETE: del, POST: create })
);

async function get(req: NextIronRequest): Promise<ErrorRes | GetRes<PartData>> {
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
  if (!req.body) return BodyRequired;

  const b: CreatePartReq = JSON.parse(req.body);

  const c = await getClientFromSession(req.session);
  const res = await c.parts.createPart({
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
  });

  return { status: 200, id: res.data.data.id };
}
