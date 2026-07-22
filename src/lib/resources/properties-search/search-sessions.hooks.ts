// developer-owned: bounded, direct-ID Search Session inspection hooks.
import { SearchSessionData } from "@vertexvis/api-client-node";

import { ErrorRes, Res } from "../../api/contracts";
import { requiredPathParam, type VertexRouteSpec } from "../../api/route";
import { NextIronRequest } from "../../with-session";

interface DetailInput {
  readonly id: string;
}

type SearchSessionResult = (SearchSessionData & Res) | ErrorRes;

function parseDetail(req: NextIronRequest): DetailInput | ErrorRes {
  if (Array.isArray(req.query.id)) {
    return { message: "Invalid search session ID.", status: 400 };
  }
  const id = requiredPathParam(req, "id", "Search session ID");
  return typeof id === "string" ? { id } : id;
}

export const searchSessionsDetailRouteSpec: VertexRouteSpec<
  DetailInput,
  undefined,
  SearchSessionResult
> = {
  operations: {
    GET: {
      execute: async ({ client, input }) => ({
        ...(await client.searchSessions.getSearchSession({ id: input.id })).data
          .data,
        status: 200,
      }),
      parse: parseDetail,
    },
  },
};
