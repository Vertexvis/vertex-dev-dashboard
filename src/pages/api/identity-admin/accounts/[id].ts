import { createVertexRoute } from "../../../../lib/api/route";
import { accountDetailRouteSpec } from "../../../../lib/resources/identity-admin/identity-admin.hooks";
import withSession from "../../../../lib/with-session";

export const handleIdentityAdminAccount = createVertexRoute(
  accountDetailRouteSpec
);
export default withSession(handleIdentityAdminAccount);
