import { createVertexRoute } from "../../../../lib/api/route";
import { webhookDetailRouteSpec } from "../../../../lib/resources/identity-admin/identity-admin.hooks";
import withSession from "../../../../lib/with-session";

export const handleIdentityAdminWebhook = createVertexRoute(
  webhookDetailRouteSpec
);
export default withSession(handleIdentityAdminWebhook);
