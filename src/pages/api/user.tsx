import assert from "assert";
import { NextApiResponse } from "next";

import withSession, { getToken, NextIronRequest } from "../../lib/with-session";

export default withSession(function handler(
  req: NextIronRequest,
  res: NextApiResponse
) {
  const token = getToken(req.session);
  assert(token);

  res.send({ id: token.token.account_id, isLoggedIn: true });
});
