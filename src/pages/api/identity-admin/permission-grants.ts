import { createVertexRoute } from "../../../lib/api/route";
import { permissionGrantsRouteSpec } from "../../../lib/resources/identity-admin/identity-admin.hooks";
import withSession from "../../../lib/with-session";

export const handleIdentityAdminPermissionGrants = createVertexRoute(
  permissionGrantsRouteSpec
);
export default withSession(handleIdentityAdminPermissionGrants);
