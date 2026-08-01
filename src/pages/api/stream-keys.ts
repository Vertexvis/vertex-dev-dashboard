import {
  isFailure,
  StreamKeysApiCreateSceneStreamKeyRequest,
} from "@vertexvis/api-client-node";

import {
  BodyRequired,
  ErrorRes,
  InvalidBody,
  Res,
  toErrorRes,
} from "../../lib/api";
import { methodRouter } from "../../lib/api-handler";
import { getClientFromSession, makeCall } from "../../lib/vertex-api";
import withSession, { NextIronRequest } from "../../lib/with-session";

export interface CreateStreamKeyRes extends Res {
  readonly key: string;
}

type CreateStreamKeyReq = Pick<StreamKeysApiCreateSceneStreamKeyRequest, "id">;

export default withSession(methodRouter({ POST: create }));

async function create(
  req: NextIronRequest,
): Promise<ErrorRes | CreateStreamKeyRes> {
  if (!req.body) return BodyRequired;

  const b: CreateStreamKeyReq = JSON.parse(req.body);
  if (!b.id) return InvalidBody;

  const c = await getClientFromSession(req.session);
  const r = await makeCall(() =>
    c.streamKeys.createSceneStreamKey({
      id: b.id,
      createStreamKeyRequest: {
        data: { type: "stream-key", attributes: { expiry: 86400 } },
      },
    }),
  );
  return isFailure(r)
    ? toErrorRes({ failure: r })
    : { key: r.data.attributes.key ?? "", status: 200 };
}
