import { NextApiResponse } from "next";

import { MethodNotAllowed } from "../../lib/api";
import { getToken } from "../../lib/vertex-api";
import withSession, { NextIronRequest } from "../../lib/with-session";

export type LoginReq = {
  id: string;
  secret: string;
};

export default withSession(async function (
  req: NextIronRequest,
  res: NextApiResponse
) {
  if (req.method === "POST") {
    const b: LoginReq = JSON.parse(req.body);
    const token = await getToken(b.id, b.secret);

    req.session.set("creds", {
      id: b.id,
      secret: b.secret,
    });
    req.session.set("token", {
      token,
      expiration: Date.now() + token.expires_in * 1000,
    });

    await req.session.save();

    const r = { status: 200 };
    return res.status(r.status).json(r);
  }

  return res.status(MethodNotAllowed.status).json(MethodNotAllowed);
});
