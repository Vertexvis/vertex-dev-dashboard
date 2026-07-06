import {
  FileList,
  FileMetadataData,
  getPage,
  head,
  logError,
  VertexError,
} from "@vertexvis/api-client-node";
import { AxiosResponse } from "axios";
import { NextApiResponse } from "next";

import {
  ErrorRes,
  GetRes,
  MethodNotAllowed,
  ServerError,
  toErrorRes,
} from "../../../../lib/api";
import { getClientFromSession } from "../../../../lib/vertex-api";
import withSession, { NextIronRequest } from "../../../../lib/with-session";

export async function handleFileCollectionFiles(
  req: NextIronRequest,
  res: NextApiResponse<GetRes<FileMetadataData> | ErrorRes>
): Promise<void> {
  if (req.method === "GET") {
    const r = await get(req);
    return res.status(r.status).json(r);
  }

  return res.status(MethodNotAllowed.status).json(MethodNotAllowed);
}

export default withSession(handleFileCollectionFiles);

async function get(
  req: NextIronRequest
): Promise<ErrorRes | GetRes<FileMetadataData>> {
  try {
    const id = head(req.query.id);
    if (id == null)
      return { message: "File Collection ID required.", status: 400 };

    const pageSize = head(req.query.pageSize);
    const cursor = head(req.query.cursor);
    const sort = head(req.query.sort);
    const c = await getClientFromSession(req.session);
    const params = new URLSearchParams({
      "page[size]": pageSize ? Number.parseInt(pageSize, 10).toString() : "10",
    });
    if (cursor != null) params.set("page[cursor]", cursor);
    if (sort != null) params.set("sort", sort);

    const { cursors, page } = await getPage(
      () =>
        c.axiosInstance.get<FileList>(
          `${c.config.basePath}/file-collections/${encodeURIComponent(
            id
          )}/files?${params.toString()}`,
          {
            headers: {
              Accept: "application/vnd.api+json",
              Authorization: `Bearer ${c.token.access_token}`,
            },
          }
        ) as Promise<AxiosResponse<FileList>>
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
