import * as ironSession from "next-iron-session";

import { getClientFromSession } from "../vertex-api";
import { CookieAttributes } from "../with-session";

const VertexAPIStorageEngine = {
  _handleFile: async function (req, file, cb) {
    await ironSession.applySession(req, null, CookieAttributes);

    const id = req.query.f;
    const client = await getClientFromSession(req.session);
    try {
      await client.files.uploadFile({ id, body: file.stream });
      cb(null, { path: "/files/" + id });
    } catch (err) {
      cb(err);
    }
  },

  _removeFile() {
    return;
  },
};

export default VertexAPIStorageEngine;
