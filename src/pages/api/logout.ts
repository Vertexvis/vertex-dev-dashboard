import { NextApiResponse } from "next";

import withSession, { NextIronRequest } from "../../lib/with-session";

export default withSession(function (
  req: NextIronRequest,
  res: NextApiResponse
) {
  req.session.destroy();
  const r = { status: 200 };
  return res.status(r.status).json(r);
});
