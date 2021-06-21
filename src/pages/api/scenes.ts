import {
  defined,
  Failure,
  getPage,
  head,
  SceneData,
} from "@vertexvis/api-client-node";
import { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/client"

import { getClient, makeCall } from "../../lib/vertex-api";

export interface Res {
  readonly status: number;
}

export interface ErrorRes extends Res {
  readonly message: string;
}

export interface GetSceneRes extends Res {
  readonly cursor?: string;
  readonly data: SceneData[];
}

type DeleteSceneRes = Res;

interface DeleteBody {
  readonly ids: string[];
}

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse<GetSceneRes | DeleteSceneRes | ErrorRes>
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

async function get(req: NextApiRequest): Promise<ErrorRes | GetSceneRes> {
  try {
    const c = await getClient();
    const session = await getSession({ req })
    console.log(`Getting scenes for user:`, session?.user);

    const ps = head(req.query.pageSize);
    const pc = head(req.query.cursor);
    const r = await getPage(() =>
      c.scenes.getScenes({
        pageCursor: pc,
        pageSize: ps ? parseInt(ps, 10) : 10,
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

async function del(req: NextApiRequest): Promise<ErrorRes | DeleteSceneRes> {
  const b: DeleteBody = JSON.parse(req.body);
  if (!req.body) return { message: "Body required.", status: 400 };
  if (!b.ids) return { message: "Invalid body.", status: 400 };

  await Promise.all(
    b.ids.map((id) => makeCall((c) => c.scenes.deleteScene({ id })))
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
