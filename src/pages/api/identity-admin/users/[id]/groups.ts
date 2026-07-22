import { createVertexRoute } from "../../../../../lib/api/route";
import { userGroupsRouteSpec } from "../../../../../lib/resources/identity-admin/identity-admin.hooks";
import withSession from "../../../../../lib/with-session";

export const handleIdentityAdminUserGroups =
  createVertexRoute(userGroupsRouteSpec);
export default withSession(handleIdentityAdminUserGroups);
