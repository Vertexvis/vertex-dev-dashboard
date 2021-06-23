import {
  defined,
  Failure,
  getPage,
  head,
  PartData,
} from "@vertexvis/api-client-node";
import { NextApiRequest, NextApiResponse } from "next";

import { getClient, makeCall } from "../../lib/vertex-api";

export interface Res {
  readonly status: number;
}

export interface ErrorRes extends Res {
  readonly message: string;
}

export interface GetPartsRes extends Res {
  readonly cursor?: string;
  readonly data: PartData[];
}

type DeletePartRes = Res;

interface DeleteBody {
  readonly ids: string[];
}

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse<GetPartsRes | DeletePartRes | ErrorRes>
): Promise<void> {
  if (req.method === "GET") {
    const r = await get(req);
    return res.status(r.status).json(r);
  }

  if (req.method === "DELETE") {
    const r = await del(req);
    return res.status(r.status).json(r);
  }

  return res.status(405).json({ message: "Method not allowed.", status: 405 });
}

async function get(req: NextApiRequest): Promise<ErrorRes | GetPartsRes> {
  try {
    const c = await getClient();
    const ps = head(req.query.pageSize);
    const pc = head(req.query.cursor);
    const sId = head(req.query.suppliedId);

    const r = await getPage(() =>
      c.parts.getParts({
        pageCursor: pc,
        pageSize: ps ? parseInt(ps, 10) : 10,
        filterSuppliedId: sId
      })
    );
    return { cursor: r.cursor, data: r.page.data, status: 200 };
  } catch (error) {
    console.error("Error calling Vertex API", error);
    return error.vertexError?.res
      ? toErrorRes(error.vertexError?.res)
      : { message: "Unknown error from Vertex API.", status: 500 };
  }
}

async function del(req: NextApiRequest): Promise<ErrorRes | DeletePartRes> {
  const b: DeleteBody = JSON.parse(req.body);
  if (!req.body) return { message: "Body required.", status: 400 };
  if (!b.ids) return { message: "Invalid body.", status: 400 };

  await Promise.all(
    b.ids.map((id) => makeCall((c) => c.parts.deletePart({ id })))
  );
  return { status: 200 };
}


export function toErrorRes({ failure }: { failure: Failure }): ErrorRes {
  const fallback = "Unknown error.";
  const res = { message: fallback, status: 500 };
  if (failure == null || failure.errors == null) return res;

  const es = [...failure.errors];
  if (es == null || es.length === 0) return res;

  return {
    message: es[0].title ?? fallback,
    status: parseInt(es[0].status ?? "500", 10),
  };
}

export function isErrorRes(obj?: {
  message?: string;
  status?: number;
}): obj is ErrorRes {
  return defined(obj) && defined(obj.message) && defined(obj.status);
}
