import { getClient } from "../vertex-api";

const VertexAPIStorageEngine = {
  _handleFile: async function(req, file, cb) {
    const id = req.query.f;
    const client = await getClient();
    try {
      await client.files.uploadFile({ id, body: file.stream });
      cb(null, {
        path: "/files/" + id,
      });
    } catch (err) {
      cb(err);
    }
  },

  _removeFile() {
    return;
  },
};

export default VertexAPIStorageEngine;
