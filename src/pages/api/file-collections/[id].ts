import {
  FileCollectionMetadataData,
  head,
  logError,
  VertexError,
} from "@vertexvis/api-client-node";
import { NextApiResponse } from "next";

import {
  ErrorRes,
  isErrorFailure,
  MethodNotAllowed,
  Res,
  ServerError,
  toErrorRes,
} from "../../../lib/api";
import { getFileCollectionsApi } from "../../../lib/file-collections";
import { getClientFromSession, makeCall } from "../../../lib/vertex-api";
import withSession, { NextIronRequest } from "../../../lib/with-session";

interface GetFileCollectionRes extends Res {
  readonly data: FileCollectionMetadataData;
}

export async function handleFileCollection(
  req: NextIronRequest,
  res: NextApiResponse<GetFileCollectionRes | ErrorRes>
): Promise<void> {
  if (req.method === "GET") {
    const r = await get(req);
    return res.status(r.status).json(r);
  }

  return res.status(MethodNotAllowed.status).json(MethodNotAllowed);
}

export default withSession(handleFileCollection);

async function get(
  req: NextIronRequest
): Promise<ErrorRes | GetFileCollectionRes> {
  try {
    const id = head(req.query.id);
    if (id == null)
      return { message: "File Collection ID required.", status: 400 };

    const c = getFileCollectionsApi(await getClientFromSession(req.session));
    const res = await makeCall(() => c.getFileCollection({ id }));
    if (isErrorFailure(res)) return toErrorRes({ failure: res });

    return { data: res.data, status: 200 };
  } catch (error) {
    const e = error as VertexError;
    logError(e);
    return e.vertexError?.res
      ? toErrorRes({ failure: e.vertexError?.res })
      : ServerError;
  }
}
