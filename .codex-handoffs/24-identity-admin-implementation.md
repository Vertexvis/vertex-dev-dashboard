# Identity & Administration implementation handoff

## Scope and ownership

This additive, read-only implementation owns only the Identity/Admin paths:

- `src/components/identity-admin/**`
- `src/pages/identity-admin/**`
- `src/pages/api/identity-admin/**`
- `src/lib/resources/identity-admin/**`
- its targeted Node MSW, component, and Playwright tests.

It does not modify existing dashboard UX, shared navigation, the API resource
manifest/generator, Collaboration, or the test harness. A parent integration
change should add an SPA `AppLink` entry for `/identity-admin` in the new Admin
navigation section. That is deliberately not included here because
`LeftDrawer` is shared with other active areas.

## Delivered developer surface

`/identity-admin` is an authenticated, additive workspace with five sections:

1. **Directory** lists users with documented IDP-ID filter and cursor paging;
   selecting a user reads their canonical group memberships.
2. **Applications** lists OAuth application metadata only. It does not create,
   edit, delete, or reveal application credentials.
3. **Access** lists permission grants and provides explicit-ID, read-only
   account lookup. It does not change grants or accounts.
4. **Webhooks** lists subscription metadata. Endpoint URLs are masked to their
   scheme/host and every other path/query/userinfo component is removed;
   signing secrets are removed at the API boundary before browser serialization.
5. **OAuth2** is an explicit safety panel: no browser route mints/revokes a
   token or accepts OAuth login/consent challenges.

All local handlers retain the `withSession`/server-side Vertex client
credential boundary. Browser SWR data cannot contain a webhook secret or a raw
subscriber endpoint from these routes.

## SDK operation matrix (installed `@vertexvis/api-client-node@0.44.0`)

| Area              | Typed operation used                                                     | Local route                                          | Result                                                                                               |
| ----------------- | ------------------------------------------------------------------------ | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Users             | `users.listUsers`, `users.getUser`, `users.getUserGroupsForUser`         | `/api/identity-admin/users`, `/[id]`, `/[id]/groups` | Read-only directory and membership inspection.                                                       |
| User groups       | `UserGroupsApi.getUserGroup`                                             | None                                                 | **Deferred**: SDK declares `AxiosResponse<void>`; no raw-Axios workaround.                           |
| Accounts          | `accounts.getAccount`                                                    | `/api/identity-admin/accounts/[id]`                  | Explicit-ID read only; SDK has no account list operation.                                            |
| Applications      | `applications.getApplications`, `getApplication`                         | `/applications`, `/applications/[id]`                | Read-only; create response can contain a client secret so creation is withheld.                      |
| Permission grants | `permissionGrantsApi.listPermissionGrants`, `getPermissionGrant`         | `/permission-grants`, `/[id]`                        | Read-only; grant create/remove withheld.                                                             |
| Webhooks          | `webhookSubscriptions.getWebhookSubscriptions`, `getWebhookSubscription` | `/webhook-subscriptions`, `/[id]`                    | Read-only safe projection; no raw endpoint or secret reaches React.                                  |
| OAuth2            | `oAuth2.createToken`, `revokeToken`, consent/login accept                | None                                                 | **Deferred**: consumes/returns credentials or challenges; needs server-only audit/security approval. |

## Input and capability handling

- Scalar query values reject repeats and blank values before a Vertex client is
  constructed. Page sizes are positive and capped at 100.
- Users alone allow `filterIdpId`; the other list routes reject that field.
- Existing route error mapping preserves upstream 401/403/404 errors as visible
  non-empty capability responses, rather than treating them as empty lists.
- No mutation route, no OAuth handler, no webhook test-delivery action, and no
  hidden raw request fallback was added.

## Verification already run

| Check                            | Result                                                                                                                             |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Targeted Node MSW contract suite | Passed, 4 tests. Verifies Users query serialization, early repeated-query rejection, canonical memberships, and webhook redaction. |
| Targeted browser component suite | Passed, 2 tests. Verifies user/group inspection, unavailable Applications response, and masked webhook display.                    |
| Targeted Playwright              | Passed, including local guarded-session setup and Identity/Admin route interception.                                               |
| `yarn lint --quiet`              | Passed before tests.                                                                                                               |
| `yarn build`                     | Passed before tests.                                                                                                               |
| `git diff --check`               | Passed before handoff.                                                                                                             |

Playwright was run via the PR #326 local guarded-session harness. No Docker or
Testcontainers test was created or used.

## Navigation integration follow-up

The shared dashboard drawer now exposes **Identity & Administration** through
`AppLink` at `/identity-admin`, retaining client-side SPA navigation and the
existing selected-route convention. Existing concurrent Scene Preview and
Properties & Search navigation changes were preserved. `AppLink` now forwards
its anchor ref, which is required when it is used as a Material `ListItemButton`
component and removes the MUI ref warning without changing link behavior.

Focused navigation coverage was added in
`src/__tests__/components/shared/LeftDrawer.test.tsx`; the SPA `href` test,
lint, and `git diff --check` pass.

## Validator checklist

1. Re-run targeted Node/browser/Playwright tests, then the full relevant Node,
   browser, lint, format check, build, and `git diff --check` gates after the
   parent integrates navigation.
2. Inspect `identity-admin.hooks.ts` to confirm `maskedWebhook` returns only
   `created`, `status`, `topics`, and masked `url`; assert no raw URL, query,
   userinfo, or `secret` string appears in an API response, SWR fixture,
   rendered DOM, or test trace.
3. Stub 401/403 for every tab and verify the error remains visible rather than
   becoming an empty-list state.
4. Confirm no route exposes `UserGroupsApi.getUserGroup` and no OAuth route is
   added without a fresh security design and one-shot secret/audit review.
5. Confirm shared `LeftDrawer` integration uses SPA `AppLink` and introduces no
   changes to current Files, Parts, Scene, Viewer, or Documents UX.
