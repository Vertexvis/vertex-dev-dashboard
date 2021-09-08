import { head, VertexError } from "@vertexvis/api-client-node";
import { Request } from "express";
import * as ironSession from "next-iron-session";

import { getClientFromSession } from "../vertex-api";
import { CookieAttributes } from "../with-session";

const VertexAPIStorageEngine = {
  _handleFile: async (
    req: Request & { session: ironSession.Session },
    file: Express.Multer.File,
    cb: (error?: Error, info?: Partial<Express.Multer.File>) => void
  ): Promise<void> => {
    await ironSession.applySession(req, null, CookieAttributes);

    const id = req.query.f;
    const client = await getClientFromSession(req.session);
    try {
      await client.files.uploadFile({
        id: (head(id) ?? "") as string,
        body: file.stream,
      });
      cb(undefined, { path: "/files/" + id });
    } catch (err) {
      const e = err as VertexError;
      cb(e);
    }
  },

  _removeFile(): void {
    return;
  },
};

export default VertexAPIStorageEngine;
