# Remaining Platform API decomposition — identity, integrations, collaboration, properties

## Purpose and evidence

This is a research/planning handoff only. It defines independently implementable dashboard areas after the framework/Core/Scene/Exports/Documents work; it does **not** authorize implementation.

- The checked-in resource catalog is `api-resources.json`; there is no local `api.yml` or OpenAPI document to split. Treat the [official Vertex Platform API reference](https://docs.vertex3d.com/) as the endpoint inventory and `@vertexvis/api-client-node@0.44.0` installed declarations as the SDK support contract. Do not infer operations by parsing docs at runtime.
- The official reference lists `accounts`, `applications`, `attachments`, `collaboration-contexts`, `oauth2`, `permission-grants`, `property-entries`, `property-key-policies`, `replies`, `search-sessions`, `threads`, `users`, `user-groups`, and `webhook-subscriptions`; it marks the Engage collaboration families as module-gated and preview where applicable.
- The installed SDK has typed API classes for all requested families: `AccountsApi`, `ApplicationsApi`, `UsersApi`, `UserGroupsApi`, `PermissionGrantsApi`, `WebhookSubscriptionsApi`, `Oauth2Api`, `CollaborationContextsApi`, `ThreadsApi`, `RepliesApi`, and `AttachmentsApi`. It also has `PropertyEntriesApi`, `PropertyKeyPoliciesApi`, and `SearchSessionsApi` for the next independent area.
- Important SDK gate: `UserGroupsApi.getUserGroup` is declared to return `AxiosResponse<void>` even though the package declares `UserGroup`/`UserGroupData`. Do not use a guessed raw request to paper over it. A focused current-doc/SDK upgrade investigation must decide whether to upgrade, omit the detail view, or retain only verified create/assignment flows.

All browser-to-Vertex calls continue through a session-wrapped Next Pages API route; React must never receive a Vertex bearer token, client secret, OAuth token, webhook secret, or presigned attachment URL in an SWR cache.

## Independent dashboard areas and delivery order

The groups below deliberately minimize overlapping files. Each group gets its own research → implementation → adversarial validation loop and a draft stacked commit/PR only after acceptance. The first three can be researched in parallel; do not concurrently edit `api-resources.json`, shared route framework code, `LeftDrawer`, or generic components.

| Area / proposed catalog group | Vertex APIs                                                                                                         | Developer-facing surface                                                                | Dependency / parallelism                                                                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `properties-search`           | `property-entries`, `property-key-policies`, `search-sessions`                                                      | Scoped property explorer/editor plus policy manager and a session-query laboratory      | Independent of identity/collaboration; can begin now. Uses custom query/body hooks.                                                                                 |
| `identity-directory`          | `users`, `user-groups`, `collaboration-contexts` membership endpoints                                               | Read-first directory, group membership, and context access inspector                    | Can begin now. Shares only generic picker/table primitives with collaboration. Respect the user-group SDK detail gate.                                              |
| `collaboration-engage`        | `collaboration-contexts`, `threads`, `replies`, `attachments`                                                       | Context workspace with thread/reply timeline and contextual attachments                 | Starts its UI after `identity-directory` exposes stable user/group pickers, but its route/SDK research and mocks can run in parallel. Module/preview gate required. |
| `access-control`              | `accounts`, `applications`, `permission-grants`                                                                     | Separate privileged admin workspace for account/app management and grants               | Can run in parallel with collaboration. Depends on a one-shot secret response primitive before application create is enabled.                                       |
| `integrations-security`       | `webhook-subscriptions`, selected safe OAuth2 administration operations                                             | Webhook subscription inspector and narrowly scoped OAuth diagnostic/revocation controls | Can research in parallel; implement after the one-shot-secret primitive/security review. It is the highest-risk area.                                               |
| `scene-advanced`              | remaining scene APIs: alterations, annotations, overrides, synchronizations, batches, hits/canvases/model views/PMI | Existing Scene Workspace advanced tabs                                                  | Separate from this handoff, but should continue as an independent area.                                                                                             |

Do not combine `access-control` and `integrations-security`: applications/webhooks can return credentials or signing secrets, while permission grants change account-wide access. Their validation and review burden differs materially.

## Common framework contract for every new group

Use the existing generated scaffold only for routine local route/client adapters. Every resource manifest entry explicitly declares allowed local operations; routes make explicit typed SDK calls. Never dispatch an SDK method/resource name from browser input.

1. Generate collection/detail scaffolds only where SDK operation shape is routine and verified. Keep developer-owned `*.hooks.ts` implementations with the typed SDK call, request normalizer, response normalizer, cache invalidations, and per-operation capability checks.
2. Preserve the `createVertexRoute` lifecycle: parse/query → session/client acquisition → `beforeRequest` → `beforeValidate` → `validate` → transforms → `beforeCall` → execute → `afterCall` → `afterResponse` / `onError`. Parsing must reject unknown fields, malformed UUIDs, repeated scalar query values, unsupported enum values, unallowlisted include/fields/sort values, and overlarge pages before an upstream client is constructed.
3. Add hooks rather than weakening global route behavior for: dependent-resource validation, relationship picker selection, JSON:API relationship serializers, safe feature/module gate mapping, precise filter construction, response redaction, confirmation preflight, and mutation invalidation.
4. Reuse `VectorTable`, `TableToolbar`, cursor pagination, `RowActionsMenu`, `DataLoadError`, `SkeletonBody`, `AppLink`, `ResourceLink`, `confirm-delete`, and the generator's typed client pattern. New generic components should be added only after both identity and collaboration need them.
5. Preserve all existing pages and interactions. Add a distinct Admin/Integrations navigation section and additive workspace pages; do not repurpose the current Scenes, Files, Parts, Viewer, or login UX.

### Required shared primitives (implement once, only when the first consumer is approved)

- **`CapabilityGate` / module gate:** maps known `401`, `403`, `404`/feature-unavailable responses to an explicit, non-destructive unavailable panel with refresh/request-access guidance. It must not hide an existing page or turn a permissions error into an empty list.
- **`OneShotSecretResult`:** renders an application secret or webhook signing secret only for the immediate successful create response, with reveal/copy acknowledgement and no remount persistence. Never log it, put it in a URL, route response cache, SWR key/data, local/session storage, browser history, test snapshots, error messages, or analytics. The API route returns `Cache-Control: no-store, private`; redact this field in structured logging.
- **`RelationshipPicker`:** server-paged typed search/select control that holds only IDs/display text in the browser, explicitly names allowable types, and rejects invalid context/account/group/thread relationships server-side.
- **`MutationConfirmation`:** explicit confirmation for delete, access grant/removal, membership addition, webhook create/change/delete, application/account mutation, OAuth token revoke, context deletion, and published thread/reply updates. Show scope and impact; do not infer authorization from a client-side button state.

## Area A — Identity directory and context access

### SDK operation matrix

| API                        | Verified SDK operations                                                                         | Notes / gate                                                                                                                                                              |
| -------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `UsersApi`                 | `listUsers(filterIdpId, pageCursor, pageSize)`, `getUser`, `createUser`, `getUserGroupsForUser` | Directly suitable for cursor list, IDP-ID filter, detail and group membership inspection.                                                                                 |
| `UserGroupsApi`            | `createUserGroup`, `addUsersToUserGroup`, `getUserGroup`                                        | `getUserGroup` is typed `void` in 0.44.0: detail/member read cannot proceed without a documented SDK correction/upgrade decision. There is no list operation in this SDK. |
| `CollaborationContextsApi` | list/get/create/delete, add user groups, get users for context with query/cursor/page size      | Official docs say Engage module. This route family is shared with collaboration but access assignment is safe to plan read-first here.                                    |

### UX and phases

**Phase A1 — read-first Directory (safe):** an additive `/directory` page lists users (full name, email, IDP ID, created time), IDP ID filter, detail drawer, copy ID, and the user's paged group memberships. The page should accurately distinguish “no users” from “directory unavailable.” Do not show email beyond the existing authenticated administrator context, and do not add a free-text global people search unless the documented endpoint supports it.

**Phase A2 — group/context relationship management (guarded):** use a Group and Context panel driven from selected IDs. Allow create user/group/context and add known user IDs to a user group / known group IDs to a context only after server-side existence and duplicate checks. Context deletion removes its data according to the docs, so it requires named confirmation and starts disabled behind a read-only-by-default local feature flag. Do not invent group removal because the verified SDK contract does not expose it.

**Phase A3 — context access inspector (safe):** on a context, use `getUsersForCollaborationContext` with a debounced server query by email/full name and cursor paging. This becomes the selection source for Collaboration but does not create threads itself.

### Hooks and tests

- List-query hook: allow `filterIdpId`, `filterQuery`, cursor and bounded page size only. Reset cursor when either filter changes.
- Relationship hook: normalize UUID arrays, de-duplicate, cap count, verify selected resources against the canonical upstream list/detail route, and return partial/duplicate warnings without issuing duplicate mutations.
- Context mutation hook: reject delete unless the server receives a human-confirmation field and confirm token; always reload canonical list/detail after success.
- Unit/Msw: query validation, cursor reset, SDK `void` group-detail gate, server-side duplicate suppression, 401/403 module gate, response envelopes and invalidation keys.
- Component: loading/empty/unavailable/error states; group/context confirmation; no optimistic membership claim; keyboard-accessible picker.
- Playwright controlled upstream: list/filter a user → open group memberships → create/add a permitted test relationship → reload canonical state; exercise an Engage-unavailable fixture. Never run account-wide destructive flows against shared live credentials.

## Area B — Collaboration Engage workspace

### SDK operation matrix

| API                        | Verified SDK operations                               | Important request/query support                                                                                                                                                                                               |
| -------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CollaborationContextsApi` | list/get/create/delete, add groups, users-for-context | Context IDs are the workspace root.                                                                                                                                                                                           |
| `ThreadsApi`               | list/get/create/update/delete, participants           | List supports `fieldsThread`, context ID array, cursor/page size, include, status array, group array. Thread attributes include open/resolved status, draft state, title/body/bodyDocument, reference, mentions, reply count. |
| `RepliesApi`               | list/get/create/update/delete                         | List filters by `threadId`, supports cursor/page size/include. Reply attributes include drafting/body/bodyDocument/reference/mentions.                                                                                        |
| `AttachmentsApi`           | list, create, create upload URL, create download URL  | Official docs label attachments Engage-required and preview. List requires relationship ID and relationship type (`thread`/`reply`); pre-signed URLs are sensitive.                                                           |

### UX and safe phases

**Phase B1 — read-only context workspace:** `/collaboration/[contextId]` contains a context header and a threaded conversation list. A user chooses a context from the Directory; default filter is open threads. Thread details show author, participants, status, reference type/ID, reply count, and safe text rendering. `include`/sparse fields are local allowlists, not raw query passthrough. The entire page sits behind `CapabilityGate` and shows the preview label for attachments.

**Phase B2 — controlled conversation mutation:** create a thread in the selected context, then create/update/delete replies and update thread status through structured composer fields. Default to drafts if the verified payload semantics support it; publish/resolve/delete each require confirmation. Sanitize/plain-render returned text and never use `dangerouslySetInnerHTML` for body documents. Mentions need a selected-context user picker, not arbitrary identifiers pasted from the client.

**Phase B3 — attachments (preview + gated):** allow attachment metadata creation and upload only in a selected thread/reply. The browser uploads directly to the one-time presigned URL after the server obtains it; the local route must neither proxy file bytes nor return an upload/download URL to a reusable query cache. Download action requests a fresh URL only on click, applies `no-store`, navigates immediately, and redacts URL strings from errors/logs/tests. Do not retry an upload URL or expose it in a link href rendered by React.

**Phase B4 — integration with Scene/Documents:** expose a typed `scene`/`document` reference picker only after both reference payloads and authorization behavior are confirmed. Keep this a custom relationship serializer, not a generic “paste any resource JSON” field.

### Hooks and tests

- Context binding hook requires `contextId` for every thread read/mutation and confirms the returned thread relationship matches the selected context.
- Thread/reply serializer allowlists title, status (`open`/`resolved`), known body-document shape, drafting flag, selected references, and selected mention IDs; reject immutable/timestamp/author fields.
- Attachment hook validates relation type/id, filename/content type/size policy, one-shot URL expiry, and terminal upload/download outcome. Feature availability is part of the response state.
- Invalidate exact scoped keys: context thread list, selected thread, replies, participants, attachments; never broadly clear all dashboard SWR state.
- Unit/Msw: scope mismatch, include/fields/status/group allowlists, body-document schema, preview `403`/unsupported state, URL redaction, expired URL, confirmed delete, and race where a thread is deleted while a reply loads.
- Component: accessible timeline order, draft vs published labeling, no HTML injection, composer validation, attachment unavailable/queued/progress/error states, and warning before destructive actions.
- Playwright controlled upstream: select a context → filter open threads → view participants/replies → create a draft reply → resolve/reload → use attachment metadata/upload/download fixture; inspect browser network/request bodies for no bearer token or secret leak. A live test should be opt-in only after the user supplies a non-production Engage-enabled account.

## Area C — Accounts, applications, and permission grants

### SDK operation matrix

| API                   | Verified SDK operations                                     | Risk / handling                                                                                                                                                  |
| --------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AccountsApi`         | create/get/update/delete and create application for account | Account mutation/deletion is privileged; the SDK has no list operation. Entry is by verified ID, with recently visited IDs held only in current component state. |
| `ApplicationsApi`     | list/get/create/update/delete; list filter `clientId`       | Create returns `CreatedApplication` whose attributes include a **secret**; normal application read does not.                                                     |
| `PermissionGrantsApi` | list/get/create/remove                                      | Grant body is account grantee plus parts or property-sets domain subject; docs currently show `read` capability.                                                 |

### UX and safe phases

**Phase C1 — read-first Applications and grants:** `/admin/access` presents applications (filter by client ID, page), application details, and permission-grant list/detail. It does not expose account lookup from a global list because none is verified. All pages are explicitly marked privileged and `403` preserves navigation with a request-access state.

**Phase C2 — grants:** add a structured grant composer: select account ID, subject domain (`parts` or `property-sets`) and verified `read` capability. It includes a clear human explanation before confirmation. Remove is confirmed and refreshes canonical grants. Do not support arbitrary capability/domain strings.

**Phase C3 — applications/accounts (highest impact):** application create/update/delete and account create/update/delete must be separately feature-gated. Creation returns a secret only through `OneShotSecretResult`; the durable application table must not display or retrieve it. Account delete must require typed account name/ID confirmation and should not run in Playwright against a live tenant.

### Hooks and tests

- `beforeValidate` rejects non-admin state advertised by server/session capability metadata where available, but upstream remains authoritative.
- Input transformer maps the narrow form model to `Create/UpdateAccountRequest`, `Create/UpdateApplicationRequest`, and `CreatePermissionGrant` exactly; it never accepts raw JSON.
- Response transformer strips application `secret` from every normal route result and logs; only a dedicated immediate creation response can feed the one-shot presentation.
- Unit/Msw: no account list assumption, secret-redaction across success/error/logging, grant enum validation, delete confirmation, 401/403 handling, pager/filter behavior, and cache invalidation.
- Component: no secret after navigation/reload, copy/reveal acknowledgement, empty privileged state, confirmation language, no raw payload control.
- Playwright controlled upstream: list/filter app → create fixture app → capture/reveal/copy secret once → navigate/reload and assert absent; create/remove fixture grant. Use an isolated tenant or mock only for account deletion.

## Area D — Webhooks and OAuth2 administration

### SDK operation matrix

| API                       | Verified SDK operations                                | Risk / gate                                                                                                                                                                                    |
| ------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WebhookSubscriptionsApi` | list/get/create/update/delete                          | Subscription includes endpoint URL/topics/status and may include **secret**. Create/update accepts URL/topics/status; no documented “test delivery” operation in this SDK/reference inventory. |
| `Oauth2Api`               | create token, revoke token, admin accept consent/login | `createToken` and `revokeToken` require Basic Auth according to docs; token response has access/refresh tokens. Admin accept flows consume challenge values and return redirect information.   |

### UX and safe phases

**Phase D1 — read-only webhook inspector:** list/detail with endpoint host displayed, URL copied only intentionally, topic chips, state, and created time. Mask userinfo/query values in default display to avoid leaking credentials embedded in URLs. There is no “send test” button because no verified API operation supports it.

**Phase D2 — webhook mutation:** privileged create/edit/pause/resume/delete with URL HTTPS validation, topic allowlist derived from a checked-in verified profile (not browser text), confirmation, and the one-shot-secret policy. Do not make network requests to the subscriber URL from the dashboard.

**Phase D3 — OAuth diagnostics (off by default):** do **not** expose generic token minting in the browser dashboard. The current login flow remains the only client-credential authentication UI. A restricted server-only diagnostic/revocation route may be considered only after a security owner approves secret retrieval, audit policy, Basic Auth handling, and exact scopes. Never return a token to React; revoke can accept a short-lived server-side reference/one-time pasted value and always uses no-store/redaction. Admin consent/login accept flows are not normal dashboard UI and stay excluded unless an authentication owner supplies an end-to-end authorized flow.

### Hooks and tests

- Endpoint validator: HTTPS by default; explicitly block localhost/private/link-local metadata targets unless a development-only, server-side allowlist permits them. Normalize/validate URL before persistence, mask display, and never fetch it.
- Topic/status transformer only accepts verified strings; pause/resume is an explicit status transition with confirmation.
- OAuth guard rejects requests with token/client-secret values in query strings, logs, persisted state, and client response. The test suite uses dummy values and checks redaction.
- Unit/Msw: URL SSRF defenses, secret/token redaction, no test-delivery route, pause/resume transitions, confirmation, no-store headers, malformed challenge/revoke rejection.
- Component: masked endpoint, one-shot webhook secret, unavailable admin state, destructive confirmation; no OAuth access token UI.
- Playwright controlled upstream: list → pause/resume fixture subscription → verify masking and canonical refresh; assert no outgoing browser request to webhook URL and no sensitive text remains after reload. OAuth mutation tests remain mocked/security-review-only.

## Area E — Properties and search (parallel companion plan)

This is the best next non-sensitive group to implement in parallel with the research above.

- **`PropertyEntriesApi`:** list by required `resourceId`/`resourceType`, upsert typed property values. UX is a scoped property editor launched from a selected Part Revision/Scene Item; do not expose a global unbounded property table. Validate key/value type pairs and preserve null-as-delete behavior only after confirmation.
- **`PropertyKeyPoliciesApi`:** list/get/create/delete plus entries list/upsert/delete. It has query operators (`contains`, `eq`, `gt`, `gte`, `lt`, `lte`, `neq`) that must be a mutually exclusive/explicit builder rather than free-form query forwarding. Add a policy detail workspace and typed allowlist/denylist key manager.
- **`SearchSessionsApi`:** create/get session. It needs a specialized query builder and polling/status policy based on current docs/SDK support, not the generic CRUD generator. Keep user-entered query language/schema in a feature profile until verified.

Tests: custom query-operator allowlists, required resource scope, typed metadata serialization, property-key policy entry idempotence, search pending/terminal/error, and Playwright Part/Scene selection → property inspection/update fixture. This group must not alter existing Scene Viewer metadata UX.

## Recommended next orchestration dispatches

1. Dispatch `properties-search` researcher + SDK matrix now; it can proceed without the sensitive secret primitives.
2. Dispatch `identity-directory` researcher/implementer only after the `UserGroupsApi.getUserGroup` mismatch is documented against the current reference and an upgrade/no-detail decision is made.
3. Dispatch `collaboration-engage` researcher now, then implementation after the identity picker contract and Engage-preview behavior matrix are accepted.
4. Dispatch `access-control` and `integrations-security` research in parallel, but require a security-validator handoff before any implementation or browser test that touches secrets, OAuth, accounts, or live webhooks.
5. Give each implementer an exclusive path set and a numbered handoff. A validation failure returns only that group to its implementer; it must not block unrelated read-only/research work.

## Global acceptance gates

- Documentation + installed SDK matrix recorded for every route; any mismatch is an explicit feature gate or a separate dependency-upgrade decision.
- Generated scaffolds pass `yarn api:generate:check`; developer-owned hook files have unit tests for every lifecycle override.
- `yarn format`, `yarn lint`, `yarn test`, and `yarn build` pass after each accepted group. Docker/MockServer contracts cover SDK request path/method/headers/body and preflight rejection; unavailable module/permission responses are tested.
- Playwright runs use controlled local upstream fixtures by default. Live authenticated verification requires the user-provided credentials and a non-production/isolated account; no test creates destructive tenant-wide data without explicit approval.
- Existing dashboard routes/UX retain their response and navigation contracts. New navigation is SPA `Link`/`AppLink` based; all new pages are additive.
- Validator verifies not just DOM behavior but request bodies, cache keys, `Cache-Control: no-store` for secret-bearing operations, no sensitive URLs/tokens/secrets in rendered HTML, console, logs, navigation history, screenshots, SWR/local storage, or fixtures.
