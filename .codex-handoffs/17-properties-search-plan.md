# Properties & Search — research and implementation handoff

## Scope and recommendation

Create a new additive **Properties & Search** dashboard area at
`/properties-search`, reached from the persistent dashboard drawer. It must
not modify the existing Scene Viewer metadata panel, Scene Workspace, Parts,
or Files workflows. Those screens retain their current resource-specific UX;
this area is a developer-facing workbench for exercising the Platform property
and search APIs.

The area has three deliberately separate sub-workflows under one page with
tabs (deep-linkable through `?tab=`):

1. **Entries** — inspect and deliberately upsert typed property values for one
   explicitly selected resource.
2. **Key policies** — administrate a policy and its allowed/denied property
   keys. This is its own tab because it operates at account/policy scope, not
   at the selected resource scope.
3. **Search sessions** — create and inspect a short-lived search-session for a
   scene. This is an asynchronous/status resource, not a text-search result
   table; do not pretend it performs a query locally.

This split is suitable for a separate dashboard/API grouping and can be
implemented without changing existing API UX. Additive routes/components may
share primitives, but should not refactor existing pages as incidental work.

Research date: 2026-07-21. Sources: [official Vertex Platform API
reference](https://docs.vertex3d.com/) and the installed
`@vertexvis/api-client-node@0.44.0` declarations at
`node_modules/@vertexvis/api-client-node/dist/cjs/api.d.ts`.

## API / SDK support matrix

| Area                  | Documented Platform operations                                                                                                                                    | SDK 0.44.0 support                                                                                                           | Dashboard result                                                                                                                                                                    |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Property entries      | `GET /property-entries` with cursor, page size, `filter[resourceId]`, and `filter[resourceType]`; `PATCH /property-entries` to upsert values for a relationship   | `VertexClient.propertyEntries.getPropertyEntries` and `.upsertPropertyEntries` are available                                 | Full typed, resource-scoped list/upsert surface.                                                                                                                                    |
| Property key policies | List/create/get/delete policies; list policy entries at `GET /property-key-policy-entries`; upsert/delete policy entries at `/property-key-policies/{id}/entries` | `PropertyKeyPoliciesApi` declares all seven operations, **but `VertexClient` does not expose a `propertyKeyPolicies` field** | Full surface is feasible only with a small server-only adapter constructed from the session client's `config` and `axiosInstance`; do not use raw OAuth headers/client credentials. |
| Search sessions       | `POST /search-sessions`; `GET /search-sessions/{id}`                                                                                                              | `VertexClient.searchSessions.createSearchSession` and `.getSearchSession` are available                                      | Create + direct-ID status inspection only. No list/delete/query-results operation is present in the docs/SDK snapshot.                                                              |

### Request and context constraints

| Operation             | Required context / validated input                                                                                                                                                                                                                                                                         | Important UX rule                                                                                                                                                                                                                         |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| List entries          | A resource UUID and resource type. The public reference calls the filters individually optional, but the product should require both together to prevent a broad, accidental account-wide listing.                                                                                                         | Start blank with a resource selector; do not fetch until both fields are valid.                                                                                                                                                           |
| Upsert entries        | JSON:API `data.attributes.entries` map plus `data.relationships.propertySet`. Relationship types supported by the declared request are `property-set`, `part-revision`, `part-instance`, and `scene-item`. Values are discriminated `string`, `double`, `long`, or `date`; reference also displays `object | null` in the entries union.                                                                                                                                                                                                               | Expose only the four explicit relationship types. Never coerce a long/date/double in the browser; validate exactly on the server. Do not label `null` as deletion until a live/contract verification confirms its semantic. |
| List policies         | Cursor/page size and a supplied-ID `FilterExpression` (`eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `contains`).                                                                                                                                                                                                 | Offer a single filter value plus an operator chooser, not arbitrary query-string entry. Reset cursor when either changes.                                                                                                                 |
| Create policy         | JSON:API type `property-key-policy`; optional `name`, `suppliedId`, `mode`. Mode enum is `allowlist` or `denylist`.                                                                                                                                                                                        | Make the mode explicit with copy explaining its account-wide effect. A create confirmation is not needed, but the success state must expose the generated policy ID.                                                                      |
| List policy entries   | Cursor/page size and exactly one policy ID; API also accepts supplied-ID filtering, but ID takes precedence when both are supplied.                                                                                                                                                                        | Detail drawer/page is ID-owned; never send both filters.                                                                                                                                                                                  |
| Upsert policy entries | Policy ID plus `{ data: PropertyKey[] }`, each with a non-empty `name`.                                                                                                                                                                                                                                    | Use a multi-line key editor with de-duplication and a preview of normalized keys.                                                                                                                                                         |
| Delete policy entries | Policy ID and optional comma-separated entry IDs.                                                                                                                                                                                                                                                          | UI selection required; confirmation names/counts the entries. Never issue an unfiltered delete: the SDK marks `filterId` optional, so the lifecycle hook must reject it absent/blank.                                                     |
| Delete policy         | Policy ID.                                                                                                                                                                                                                                                                                                 | Destructive confirmation, include policy name/ID and invalidate list/detail/entry keys after success.                                                                                                                                     |
| Create session        | JSON:API type `search-session`, optional `expiry`, and optional `scene` relationship.                                                                                                                                                                                                                      | Scene is optional in the declaration but a dashboard session creator should require a selected Scene so the operation is useful and bounded. Validate finite positive expiry in a conservative allowed range after confirming server max. |
| Get session           | Search-session ID.                                                                                                                                                                                                                                                                                         | Poll only while the returned `status` is nonterminal. Since no terminal-state enum is declared, stop on an explicit configured set only after contract verification; otherwise present manual refresh and cap polling.                    |

All three API families use OAuth2 and JSON:API headers in the reference/SDK.
The public API reference snapshot does not state fine-grained OAuth scopes or
tenant/module prerequisites for these operations. Treat 401/403/404 as normal
capability/context outcomes in the UI, map the Platform failure through the
existing error normalizer, and add the actual application/role findings from a
non-production tenant to the implementation handoff. Do not hide a 403 as an
empty collection.

## Developer UX

### Entries tab — “Property inspector”

- Resource target card: relationship type select (`scene-item`, `part-revision`,
  `part-instance`, `property-set`) and UUID field. Link to known Scene Workspace
  or Parts context only when an unambiguous, existing resource route exists;
  otherwise retain the entered ID.
- A cursor-paged table containing property key, value type, canonical display
  value, and entry ID. `date` renders as ISO text plus a local readable value;
  `long` remains text in the editing control to avoid JavaScript precision loss.
- “Stage changes” drawer with repeatable rows (key, type, value). The action
  issues one explicit PATCH/upsert and refreshes only the selected target.
  Existing values are never overwritten automatically, and changes are shown in
  a pre-submit diff. Keep any unverified null/remove behavior out of Phase 1.
- Empty, missing, forbidden, and malformed target states must be distinct.

### Key policies tab — “Property key policy manager”

- Cursor-paged policy table with name, mode, supplied ID, created timestamp,
  and row actions: inspect, edit keys, delete.
- Create drawer: name, optional supplied ID, required allowlist/denylist mode.
- Detail drawer: policy metadata and an independently paged entry table;
  add-key bulk editor and selected-entry remove confirmation. A policy selection
  must survive list refresh only if the ID still exists.
- Filtering uses the existing filter expression syntax but exposes it as
  accessible controls (operator + value), never free-form raw query parameters.

### Search sessions tab — “Session monitor”

- A scene ID input with optional scene lookup/link (reuse existing Scene rows
  when practical), expiry input, and Create button.
- After creation, show a compact result card (session ID, status, scene
  relationship if returned, timestamps/links if present) and permit loading a
  known session by ID. Persist only the ID in the URL query if deep linking is
  desired—no bearer token, session result blob, or credentials.
- Status display uses bounded polling with visible “last checked” and “Refresh
  now”; stop on error/unmount/terminal outcome. The implementation must verify
  real terminal statuses before enabling automatic polling.

## Required server architecture and lifecycle hooks

Add manifest entries only for generator-compatible collection/detail routes;
keep all request shaping in developer-owned hooks:

```json
[
  {
    "name": "property-entries",
    "group": "properties-search",
    "displayName": "Property Entries",
    "route": "property-entries",
    "resourceType": "property-entry",
    "operations": ["list"],
    "list": { "defaultPageSize": 25, "filters": ["resourceId", "resourceType"] }
  },
  {
    "name": "property-key-policies",
    "group": "properties-search",
    "displayName": "Property Key Policies",
    "route": "property-key-policies",
    "resourceType": "property-key-policy",
    "operations": ["list", "create", "get", "remove"],
    "list": { "defaultPageSize": 25, "filters": ["suppliedId"] }
  },
  {
    "name": "search-sessions",
    "group": "properties-search",
    "displayName": "Search Sessions",
    "route": "search-sessions",
    "resourceType": "search-session",
    "operations": ["create", "get"]
  }
]
```

The manifest is intentionally not a statement that every Platform operation is
generic CRUD. Add dedicated action routes/hooks (not generator extensions) for:

- `PATCH /api/property-entries` — parse discriminated typed values and target
  relationship, transform dashboard input into `UpsertPropertyEntriesRequest`,
  and invalidate only the matching entries cache key after success.
- `GET /api/property-key-policy-entries` — accept exactly one policy ID, cursor,
  and page size.
- `POST`/`DELETE /api/property-key-policies/[id]/entries` — strict key-array and
  non-empty selected-entry ID validation, with delete confirmation handled by
  the client and defense-in-depth no-unfiltered-delete validation in the route.

Resource hooks need these custom lifecycle behaviors:

| Hook / concern                  | Required behavior                                                                                                                                                                                                                              |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `beforeValidate`                | Enforce paired entry filters; UUID-like non-empty IDs; fixed relationship/type allowlists; page bounds; scalar (not repeated) query values; strict request shapes; key count/length limits once verified.                                      |
| `transformInput`                | Build the JSON:API envelopes and discriminated value objects server-side. Keep decimal/long/date strings uncoerced until type-specific validation.                                                                                             |
| `transformQuery` / query helper | Reuse `parseListQuery`/`toVertexListParams` only where the API matches. Policy filtering needs a custom `FilterExpression` binding; entries need direct `filter[resourceId]` and `filter[resourceType]`, not the generic nested filter syntax. |
| `beforeCall`                    | Block unfiltered entry list and policy-entry delete, and prevent session creation with no selected scene in dashboard UX.                                                                                                                      |
| `afterCall`                     | Normalize `getPage` cursors and return the existing `{ status, cursors, data }` shape for list routes; return 201/200 action payloads with only non-sensitive resource data.                                                                   |
| `onError`                       | Use framework `toRouteError`/existing Platform failure conversion. Preserve 400/401/403/404 upstream meaning; do not log request values if they may be business metadata.                                                                      |

For `PropertyKeyPoliciesApi`, create a **server-only factory** such as
`propertyKeyPoliciesFromClient(client)` that returns
`new PropertyKeyPoliciesApi(client.config, undefined, client.axiosInstance)`.
It must use the already session-authenticated client's configured token
refresher, configuration, and Axios instance. Do not extract `client.token`,
manually attach a bearer token, or add raw Axios requests just to compensate for
the 0.44.0 `VertexClient` facade omission. Add a focused regression proving the
adapter uses the client configuration and never exposes credentials in its
result.

## Existing code to reuse

| Need                         | Reuse                                                                                                                                                              | Notes                                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Session/OAuth boundary       | `withSession`, `getClientFromSession`, `src/lib/api/route.ts`                                                                                                      | Browser calls only same-origin `/api/*`.                                                           |
| Route lifecycle and errors   | `createVertexRoute`, `parseJsonBody`, `isBodyParseError`, `toRouteError`                                                                                           | Do not add `middleware.ts` or bypass the handler framework.                                        |
| List paging/query foundation | `src/lib/api/query.ts`, `getPage`, `formatCursorPaginationLabel`                                                                                                   | Extend via a resource hook; do not make all existing resources inherit special property semantics. |
| Browser API client           | `createResourceClient`, `requestJson`                                                                                                                              | Stable deterministic SWR keys; action clients can be hand-written when payloads are specialized.   |
| Page shell/navigation        | `Layout`, shared `LeftDrawer`, `Header`, `Title`, `AppLink`                                                                                                        | Add a drawer link only; existing navigation labels/routes remain unchanged.                        |
| States and tables            | `DataLoadError`, `SkeletonBody`, `TableToolbar`, `TableHead`, `RowActionsMenu`, MUI `Drawer`/`Alert`/`Table` patterns in `DocumentsPage` and File Collection views | Use accessible labels and test them; avoid introducing a generic untyped JSON editor.              |
| Destructive actions          | `confirm-delete.ts`                                                                                                                                                | Policies and entry deletion require this confirmation pattern.                                     |

## Compatibility limits and non-goals

- No change to existing Viewer `MetadataProperties`, model-view/PMI behavior,
  Scene Workspace tabs, or its data contracts. Property Entries are distinct
  from existing imported metadata and must not silently merge their displays.
- No generic “call any API” console, raw JSON API editor, credentials display,
  or direct browser-to-Vertex requests.
- No guessed search query/result API. The available search-session API is only
  create/get in the installed SDK snapshot; any subsequent result endpoint
  needs a separate docs/SDK research pass.
- No unbounded polling, broad property-entry listing, unfiltered policy-entry
  deletion, or unconfirmed policy deletion.
- No inferred null/delete semantics for property entries. Verify the Platform
  contract with MockServer/live non-production before enabling removal controls.
- Pin/recheck the SDK matrix immediately before implementation; policies being
  omitted from `VertexClient` is version-specific and should disappear from the
  adapter plan if a newer supported facade exposes it.

## Phased implementation and verification plan

### Phase 0 — contract reconnaissance (required before UX code)

1. Recheck the current official API reference/Postman definitions against the
   installed SDK versions and record exact request/response examples for all
   operations above.
2. In a disposable non-production tenant, establish capability outcomes and
   search-session terminal statuses; document expected 403/no-capability text.
3. Create Docker/MockServer expectations for JSON:API headers, exact paths,
   page/filter encoding, policy adapter auth, and every mutation body. Resolve
   property-entry null semantics before proposing entry deletion.

### Phase 1 — read paths and safe navigation

1. Add manifest entries and generate only eligible route/client stubs.
2. Add typed developer-owned entries list, policies list/detail/entries list,
   and session get hooks/adapters; create `/properties-search` tabbed page and
   drawer link.
3. Component tests: no fetch until target is complete; cursor/filter reset;
   error distinction; row drawer behavior; direct session load; no existing page
   snapshots/actions changed.
4. Node route tests: malformed/repeated query input, paired filters, page
   clamp, SDK request params, 401/403/404 normalization, and policy-facade
   adapter construction.

### Phase 2 — controlled mutations

1. Add create policy, typed entry upsert, policy-key bulk upsert, and selected
   policy-key deletion. Add property-entry removal only if Phase 0 verifies it.
2. Add policy delete confirmation and cache invalidation; leave existing Parts
   delete UX untouched.
3. Node/MockServer tests: exact JSON:API envelopes; string/double/long/date
   validation; 64-bit precision regression; invalid/disallowed target type;
   duplicate/blank keys; no-unfiltered-delete; cancellation means no request.

### Phase 3 — search-session creation and bounded monitoring

1. Add create hook/UI requiring a scene, verified expiry range, status card,
   bounded polling, and explicit refresh.
2. Tests: create request envelope and scene relationship; invalid expiry;
   initial/running/terminal/error polling transitions; cleanup on unmount; no
   OAuth/session data in URL, rendered DOM, SWR keys, or logs.

### Required quality gates

- `yarn api:generate:check`, `yarn format`, `yarn lint`, focused Jest suites,
  and `yarn build` must pass.
- Run Docker/Testcontainers MockServer route contracts in a Docker-capable
  environment; these are acceptance gates, not optional local diagnostics.
- Playwright fixtures must intercept **only local** routes and cover:
  1. entries target selection → list/filter/pagination → typed staged upsert;
  2. policy create → detail/key add → selected-key confirmation delete → policy
     confirmation delete;
  3. session create → running/status refresh → terminal/error display;
  4. 403 capability and malformed-input states; and
  5. regression navigation to existing Scenes, Files, Parts, Viewer, and Scene
     Workspace proving their existing UX remains available.
- A validator must inspect the Network panel/test request logs for no direct
  Platform request or credential exposure and adversarially attempt blank/array
  query parameters, broad reads, unfiltered deletes, stale selections, and
  unbounded polling.

## Parallelization boundaries

After Phase 0 is accepted, these can proceed independently on separate
worktrees/stacked commits:

1. **Property Entries**: adapters, target/typed-value editor, contracts/tests.
2. **Property Key Policies**: facade adapter, list/detail/key editor, contracts/tests.
3. **Search Sessions**: create/get monitor, polling component, contracts/tests.

The only shared edit should be a small, pre-agreed navigation/manifest commit.
Keep resource hooks, routes, components, and tests in separate paths per
sub-area to minimize conflicts. The cross-cutting decimal/date/value editor is
not to be generalized until both Entries and a second real consumer demonstrate
the same typed-value contract.
