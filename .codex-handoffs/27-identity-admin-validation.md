# Identity & Administration — independent validation

## Verdict

**Accepted for the delivered read-only Identity/Admin scope.** The additive
workspace preserves the existing dashboard, keeps all Vertex credentials on the
server, uses typed SDK operations through the established route lifecycle, and
correctly redacts webhook endpoint/secret data before the local API response.
No mutation, OAuth, raw-proxy, or `UserGroupsApi.getUserGroup` route is
introduced.

## Scope reviewed

- Additive authenticated `/identity-admin` workspace and `AppLink`-based
  **Identity & Administration** drawer entry.
- Read-only Users, canonical user-group membership, Applications, Permission
  Grants, explicit-ID Account, and Webhook local routes.
- Typed developer-owned identity hooks, Node MSW contracts, browser component
  tests, and controlled-local Playwright flow.

## Boundary and security review

1. Every local handler is an explicit `createVertexRoute` specification wrapped
   by `withSession`. Browser code uses only same-origin `/api/identity-admin/*`
   SWR keys; no bearer token, client secret, OAuth operation, or raw SDK method
   selector crosses the browser boundary.
2. `maskedWebhook` is used by **both** list and detail hooks. It returns only
   `created`, `status`, `topics`, and a parsed `protocol//host/…` display value.
   It drops `secret`, all userinfo, path, query, fragment, and any malformed raw
   URL. The Node MSW test proves an upstream
   `https://name:password@subscriber.example/hook?token=secret` with a webhook
   `secret` produces only `https://subscriber.example/…`; none of the sensitive
   strings appear in the serialized local response.
3. User/application/grant/account routes call the typed `VertexClient` facade;
   there is no Axios/raw fallback. List query parsing rejects repeated/blank
   scalar values before client construction, bounds pages to 100, and limits
   `filterIdpId` to Users.
4. `UserGroupsApi.getUserGroup` is not referenced or routed. User memberships
   use the separately typed `users.getUserGroupsForUser` operation, preserving
   the SDK `AxiosResponse<void>` detail deferral.
5. OAuth2 has only an explicit UI safety panel. No OAuth route, application
   create route, webhook mutation/test-delivery route, or account/grant
   mutation exists.
6. The drawer uses `ListItemButton component={AppLink} href="/identity-admin"`.
   `AppLink` forwards its anchor ref to Next Link; focused rendering verifies
   the actual SPA anchor href without changing the other existing drawer
   destinations.

## Read-only and capability behavior

- Local route errors flow through the established `toRouteError` conversion, so
  upstream 401/403/404 remains a non-empty response rather than a fabricated
  empty list. Component coverage verifies Applications 403 is visible; the
  controlled Playwright flow verifies normal directory/webhook states.
- The UI deliberately states the availability/security deferrals for group
  detail, mutation, signing-secret operations, and OAuth2. It makes no
  optimistic claims about memberships or mutations.

## Non-blocking follow-ups

1. The user-membership route is cursor-capable and returns cursors, but the UI
   currently renders only the first membership page. Add group-membership
   cursor controls before treating this as a full directory-management surface.
2. Add focused MSW/component cases for 401/403/404 on Access, Webhooks,
   Accounts, and group memberships (not merely Applications) as these
   read-only routes expand. The implementation correctly preserves error
   envelopes; broader per-tab regression coverage would make that contract
   durable.
3. A defense-in-depth normal-route projection for application attributes could
   explicitly drop a hypothetical `secret` field, even though the installed
   typed `getApplication`/`getApplications` response model contains no secret
   (only `CreatedApplication` does) and no creation route is exposed.

## Independent verification

| Check | Result |
| --- | --- |
| Targeted Node MSW Identity/Admin contracts | Passed: 1 suite / 4 tests |
| Targeted browser Identity/Admin + drawer suites | Passed: 2 suites / 3 tests |
| Local-only Playwright Identity/Admin flow | Passed: setup + 1 Chromium scenario |
| `yarn api:generate:check` | Passed |
| Scoped Prettier for Identity/Admin/navigation files | Passed |
| `git diff --check` | Passed |
| `yarn lint` | Passed: no warnings/errors |
| `yarn build` | Passed |

The Playwright command required the approved local port binding to start its
Next.js test server; it then ran entirely with guarded local session setup and
local route interception. No Docker/Testcontainers/MockServer test was added
or run; the Node contracts use the PR #326 MSW handler harness.
