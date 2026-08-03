import { createVertexRoute } from "../../../lib/api/route";
import { webhooksRouteSpec } from "../../../lib/resources/identity-admin/identity-admin.hooks";
import withSession from "../../../lib/with-session";

export const handleIdentityAdminWebhooks = createVertexRoute(webhooksRouteSpec);
export default withSession(handleIdentityAdminWebhooks);
