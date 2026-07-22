import { createVertexRoute } from "../../../lib/api/route";
import { usersRouteSpec } from "../../../lib/resources/identity-admin/identity-admin.hooks";
import withSession from "../../../lib/with-session";

export const handleIdentityAdminUsers = createVertexRoute(usersRouteSpec);
export default withSession(handleIdentityAdminUsers);
