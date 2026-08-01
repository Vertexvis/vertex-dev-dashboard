import { head } from "@vertexvis/api-client-node";

import { ErrorRes, isErrorFailure, toErrorRes } from "../../../../lib/api";
import { methodRouter } from "../../../../lib/api-handler";
import {
  fetchAllFileCollectionFiles,
  getFileCollectionExportAvailability,
  GetFileCollectionRes,
  getFileCollectionsApi,
} from "../../../../lib/file-collections";
import { getClientFromSession, makeCall } from "../../../../lib/vertex-api";
import withSession, { NextIronRequest } from "../../../../lib/with-session";

export const handleFileCollection = methodRouter({ GET: get });

export default withSession(handleFileCollection);

async function get(
  req: NextIronRequest,
): Promise<ErrorRes | GetFileCollectionRes> {
  const id = head(req.query.id);
  if (id == null)
    return { message: "File Collection ID required.", status: 400 };

  const c = getFileCollectionsApi(await getClientFromSession(req.session));
  const res = await makeCall(() => c.getFileCollection({ id }));
  if (isErrorFailure(res)) return toErrorRes({ failure: res });

  if (head(req.query.includeExportAvailability) === "true") {
    const files = await fetchAllFileCollectionFiles(c, id);
    const availability = getFileCollectionExportAvailability(files);

    return {
      data: res.data,
      export: availability,
      status: 200,
    };
  }

  return { data: res.data, status: 200 };
}
