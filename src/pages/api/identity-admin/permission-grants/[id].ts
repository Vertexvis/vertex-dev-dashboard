import { createVertexRoute } from "../../../../lib/api/route";
import { permissionGrantDetailRouteSpec } from "../../../../lib/resources/identity-admin/identity-admin.hooks";
import withSession from "../../../../lib/with-session";

export const handleIdentityAdminPermissionGrant = createVertexRoute(
  permissionGrantDetailRouteSpec
);
export default withSession(handleIdentityAdminPermissionGrant);
