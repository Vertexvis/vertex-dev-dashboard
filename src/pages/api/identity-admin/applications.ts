import { createVertexRoute } from "../../../lib/api/route";
import { applicationsRouteSpec } from "../../../lib/resources/identity-admin/identity-admin.hooks";
import withSession from "../../../lib/with-session";

export const handleIdentityAdminApplications = createVertexRoute(
  applicationsRouteSpec
);
export default withSession(handleIdentityAdminApplications);
