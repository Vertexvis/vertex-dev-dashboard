import { createVertexRoute } from "../../../../lib/api/route";
import { applicationDetailRouteSpec } from "../../../../lib/resources/identity-admin/identity-admin.hooks";
import withSession from "../../../../lib/with-session";

export const handleIdentityAdminApplication = createVertexRoute(
  applicationDetailRouteSpec
);
export default withSession(handleIdentityAdminApplication);
