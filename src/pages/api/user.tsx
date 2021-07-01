import { NextApiResponse } from "next";

import withSession, {
  NextIronRequest,
  SessionToken,
} from "../../lib/with-session";

export default withSession(function handler(
  req: NextIronRequest,
  res: NextApiResponse
) {
  const token = req.session.get("token") as SessionToken;
  res.send({
    id: token.token.account_id,
    isLoggedIn: true,
  });
});
