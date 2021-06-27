import {
  isFailure,
  StreamKeysApiCreateSceneStreamKeyRequest,
} from "@vertexvis/api-client-node";
import { NextApiRequest, NextApiResponse } from "next";

import {
  BodyRequired,
  ErrorRes,
  InvalidBody,
  MethodNotAllowed,
  Res,
  toErrorRes,
} from "../../lib/api";
import { makeCall } from "../../lib/vertex-api";

export interface CreateStreamKeyRes extends Res {
  readonly key: string;
}

type CreateStreamKeyReq = Pick<StreamKeysApiCreateSceneStreamKeyRequest, "id">;

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse<CreateStreamKeyRes | ErrorRes>
): Promise<void> {
  if (req.method === "POST") {
    const r = await create(req);
    return res.status(r.status).json(r);
  }

  return res.status(MethodNotAllowed.status).json(MethodNotAllowed);
}

async function create(
  req: NextApiRequest
): Promise<ErrorRes | CreateStreamKeyRes> {
  if (!req.body) return BodyRequired;

  const b: CreateStreamKeyReq = JSON.parse(req.body);
  if (!b.id) return InvalidBody;

  const r = await makeCall((c) =>
    c.streamKeys.createSceneStreamKey({
      id: b.id,
      createStreamKeyRequest: {
        data: { type: "stream-key", attributes: { expiry: 31536000 } },
      },
    })
  );
  return isFailure(r)
    ? toErrorRes({ failure: r })
    : { key: r.data.attributes.key ?? "", status: 200 };
}
