import { StreamKeysApiCreateSceneStreamKeyRequest } from "@vertexvis/api-client-node";

import {
  BodyRequired,
  ErrorRes,
  InvalidBody,
  isErrorFailure,
  isErrorRes,
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

export const handleStreamKeys = methodRouter({ POST: create });
export default withSession(handleStreamKeys);

async function create(
  req: NextIronRequest
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
    })
  );
  if (isErrorFailure(r)) return toErrorRes({ failure: r });
  const localError = r as unknown as { message?: string; status?: number };
  if (isErrorRes(localError)) return localError;
  return { key: r.data.attributes.key ?? "", status: 200 };
}
