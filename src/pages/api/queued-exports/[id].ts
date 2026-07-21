import type { AxiosResponse } from "axios";
import { NextApiResponse } from "next";

import { ErrorRes, MethodNotAllowed } from "../../../lib/api";
import { toRouteError } from "../../../lib/api/route";
import {
  parseOpaqueId,
  QueuedExportRes,
  toQueuedExportRes,
} from "../../../lib/artifacts";
import { getClientFromSession } from "../../../lib/vertex-api";
import withSession, { NextIronRequest } from "../../../lib/with-session";

export async function handleQueuedExport(
  req: NextIronRequest,
  res: NextApiResponse<QueuedExportRes | ErrorRes>
): Promise<void> {
  if (req.method !== "GET") {
    res.status(MethodNotAllowed.status).json(MethodNotAllowed);
    return;
  }
  const id = Array.isArray(req.query.id)
    ? undefined
    : parseOpaqueId(req.query.id);
  if (id == null) {
    res
      .status(400)
      .json({ message: "Queued export ID is required.", status: 400 });
    return;
  }

  try {
    const client = await getClientFromSession(req.session);
    // The documented terminal response is a redirect. Prevent Axios from
    // following it; resolve only a location scoped to this Platform host.
    const queued = (await client.exports.getQueuedExport(
      { id },
      {
        maxRedirects: 0,
        validateStatus: (status) =>
          status === 200 || (status >= 300 && status < 400),
      }
    )) as AxiosResponse;
    if (queued.status >= 300 && queued.status < 400) {
      const basePath = client.config.basePath;
      const exportId =
        basePath == null
          ? undefined
          : exportIdFromLocation(queued.headers.location, basePath);
      if (exportId == null) {
        res
          .status(502)
          .json({ message: "Invalid queued export completion.", status: 502 });
        return;
      }
      const terminal = await client.exports.getExport({ id: exportId });
      res.status(200).json({
        exportId: terminal.data.data.id,
        queuedExportId: id,
        state: "complete",
        status: 200,
      });
      return;
    }
    const response = toQueuedExportRes(queued.data.data, id);
    res.status(response.status).json(response);
  } catch (error) {
    const mapped = toRouteError(error);
    res.status(mapped.status).json(mapped);
  }
}

export function exportIdFromLocation(
  location: unknown,
  basePath: string
): string | undefined {
  if (typeof location !== "string" || location.trim() === "") return undefined;
  try {
    const base = new URL(basePath);
    const target = new URL(location, base);
    if (
      target.origin !== base.origin ||
      target.search !== "" ||
      target.hash !== ""
    ) {
      return undefined;
    }
    const prefix = `${base.pathname.replace(/\/$/, "")}/exports/`;
    if (!target.pathname.startsWith(prefix)) return undefined;
    const id = decodeURIComponent(target.pathname.slice(prefix.length));
    return /^[A-Za-z0-9._-]{1,200}$/.test(id) && !id.includes("/")
      ? id
      : undefined;
  } catch {
    return undefined;
  }
}

export default withSession(handleQueuedExport);
