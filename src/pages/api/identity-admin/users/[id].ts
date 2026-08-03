import { createVertexRoute } from "../../../../lib/api/route";
import { userDetailRouteSpec } from "../../../../lib/resources/identity-admin/identity-admin.hooks";
import withSession from "../../../../lib/with-session";

export const handleIdentityAdminUser = createVertexRoute(userDetailRouteSpec);
export default withSession(handleIdentityAdminUser);
