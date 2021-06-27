import { isFailure } from "@vertexvis/api-client-node";
import { NextApiRequest, NextApiResponse } from "next";

import { makeCall } from "../../lib/vertex-api";
import { ErrorRes, Res, toErrorRes } from "./scenes";

export interface CreateStreamKeyRes extends Res {
  readonly key: string;
}

interface CreateBody {
  readonly sceneId: string;
}

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse<CreateStreamKeyRes | ErrorRes>
): Promise<void> {
  if (req.method === "POST") {
    const r = await post(req);
    return res.status(r.status).json(r);
  }

  return res.status(405).json({ message: "Method not allowed.", status: 405 });
}

async function post(
  req: NextApiRequest
): Promise<ErrorRes | CreateStreamKeyRes> {
  if (!req.body) return { message: "Body required.", status: 400 };

  const b: CreateBody = JSON.parse(req.body);
  if (!b.sceneId) return { message: "Invalid body.", status: 400 };

  const r = await makeCall((c) =>
    c.streamKeys.createSceneStreamKey({
      id: b.sceneId,
      createStreamKeyRequest: {
        data: { type: "stream-key", attributes: { expiry: 31536000 } },
      },
    })
  );
  return isFailure(r)
    ? toErrorRes({ failure: r })
    : { key: r.data.attributes.key ?? "", status: 200 };
}
