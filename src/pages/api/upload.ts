import multer from "multer";
import type { NextApiResponse } from "next";
import nextConnect from "next-connect";

import VertexAPIStorageEngine from "../../lib/multer/api-storage-engine";

const ONE_MB = 1000000;

const upload = multer({
  limits: {
    fileSize: ONE_MB * 500,
  },
  storage: VertexAPIStorageEngine,
});

const apiRoute = nextConnect({
  // Handle any other HTTP method
  onError(error, _req, res: NextApiResponse) {
    console.error(error);
    res
      .status(501)
      .json({ error: `Sorry something Happened! ${error.message}` });
  },

  onNoMatch(req, res: NextApiResponse) {
    res.status(405).json({ error: `Method '${req.method}' Not Allowed` });
  },
});

// Returns middleware that processes multiple files sharing the same field name.
const uploadMiddleware = upload.array("file");

// Adds the middleware to Next-Connect
apiRoute.use(uploadMiddleware);

apiRoute.post((_req, res) => {
  res.status(200).json({ data: "success" });
});

export default apiRoute;

export const config = {
  api: {
    bodyParser: false, // Disallow body parsing, consume as stream
  },
};
