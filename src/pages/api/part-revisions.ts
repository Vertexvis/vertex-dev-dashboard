import {
  defined,
  Failure,
  head,
  logError,
  PartRevisionData,
} from "@vertexvis/api-client-node";
import { NextApiRequest, NextApiResponse } from "next";

import { getClient } from "../../lib/vertex-api";

export interface Res {
  readonly status: number;
}

export interface ErrorRes extends Res {
  readonly message: string;
}

export interface GetPartRevisionsRes extends Res {
  readonly cursor?: string;
  readonly data: PartRevisionData[];
}

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse<GetPartRevisionsRes | ErrorRes>
): Promise<void> {
  if (req.method === "GET") {
    const r = await get(req);
    return res.status(r.status).json(r);
  }

  return res.status(405).json({ message: "Method not allowed.", status: 405 });
}

async function get(
  req: NextApiRequest
): Promise<ErrorRes | GetPartRevisionsRes> {
  try {
    const c = await getClient();
    const ps = head(req.query.pageSize);
    const pId = head(req.query.partId);

    const r = await c.partRevisions.getPartRevisions({
      id: pId,
      pageSize: ps ? parseInt(ps, 10) : 10,
    });

    return { data: r.data.data, status: 200 };
  } catch (error) {
    logError(error);
    return error.vertexError?.res
      ? toErrorRes(error.vertexError?.res)
      : { message: "Unknown error from Vertex API.", status: 500 };
  }
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
