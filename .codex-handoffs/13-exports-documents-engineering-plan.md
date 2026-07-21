# Exports and Documents — engineering plan

## Delivery gate and scope boundary

This group begins only after **both** Core import/library and Scene Workspace
have passed their independent validation loops and their stacked draft PRs are
accepted. In particular, do not start while Core has unresolved mutation/
invalidation/MockServer/Playwright findings or while the Scene Workspace lacks
an accepted selected-scene/view/state contract. The Export/Documents draft PR
must be based on the accepted Scene commit (which already includes accepted Core
work).

The feature is an Artifacts workflow for developers: request a scene export,
follow its queued result, download the completed artifact safely, and register/
inspect file-backed Documents. It is not a generic job console, a global export
history, a document editor, or authorization to add undocumented document
mutation/download APIs.

All browser traffic remains same-origin `/api/...`; `withSession` and
`getClientFromSession` remain the only OAuth/client-secret boundary. Use the
accepted route framework for standard Documents list/get/create wiring, but
keep queued export, redirect resolution, and URL download handling as narrow
developer-owned action hooks. Do not add root `middleware.ts`, generic Axios
proxying, or browser-selected upstream URLs/operations/config JSON.

## Existing patterns to reuse without regressions

| Need                            | Existing implementation                                                                                                                                                          | Required reuse/constraint                                                                                                                                                                                          |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Scene source context            | Accepted Scene Workspace selected scene, selected view and selected state contracts; current scene/view-state relationship resolver in `src/pages/api/scene-view-states.ts`.     | The Exports tab receives known IDs from workspace state. It never asks the user to paste a source/resource type and validates state belongs to the selected scene server-side.                                     |
| Queue/poll/error UI             | `src/pages/file-collections/[fileCollectionId].tsx`, `src/pages/api/file-jobs.ts`, `src/pages/api/file-jobs/[id].ts`, `src/lib/file-jobs.ts`, and `src/lib/file-collections.ts`. | Follow the archive flow's explicit start → server preflight → queued ID → bounded polling → terminal result/manual refresh pattern. Do not change file-job endpoint contracts or reuse them for exports.           |
| Safe browser download           | `src/pages/api/files/[id]/download-url.ts`, `FileTable.tsx`, and `FileCollectionFilesTable.tsx`.                                                                                 | Generate URL only on the user click, use `window.open(url, "_blank", "noopener")` with same-window fallback if blocked, and show normalized local error feedback. Export URLs are never persisted/cached/rendered. |
| Route/session/error conventions | `src/lib/api/route.ts`, `contracts.ts`, `query.ts`, `client.ts`, `src/lib/api.ts`, `src/lib/vertex-api.ts`, and `src/lib/with-session.ts`.                                       | Preserve method guards, parser/validator-before-client behavior, `ErrorRes`/`GetRes` wire shapes, `toErrorRes` mapping, named raw-handler test seams, and server-only Vertex client access.                        |
| Lists/details/forms             | `TableHead`, `TableToolbar`, `RowActionsMenu`, `DataLoadError`, `SkeletonBody`, `ResourceLink`, cursor paging, `FileDetailsDrawer`, and collection/part dialogs.                 | Documents use the existing table/detail/filter/accessibility idiom. Export details are contextual cards in Scene Workspace, not an unrelated table without a scene.                                                |
| Core shared primitives          | `ConfirmDestructiveAction`, `RelationshipPicker`, `ResourceStatusChip`, `DetailsSection`, async-job status UI—only if Core accepts and ships their interfaces.                   | Reuse rather than fork. Until that acceptance, this group stays gated; do not create competing generic primitives.                                                                                                 |
| Controlled browser backend      | `scripts/run-playwright-e2e.mjs`, `playwright.config.ts`, e2e authenticated session setup, and local fixture/upstream patterns under `e2e/` and `pages/api/e2e-upstream/`.       | Extend the fail-closed local fixture mode; e2e must never contact a Vertex host. Add an SSR-safe fixture for any new page that fetches server-side data.                                                           |

## Installed SDK snapshot and mandatory verification matrix

The current installed declaration is
`node_modules/@vertexvis/api-client-node/dist/cjs/api.d.ts` for
`@vertexvis/api-client-node@0.44.0`. It establishes the following planning
facts, which must be rechecked against current official docs/Postman examples
immediately before implementation:

| Resource         | Typed 0.44.0 support observed                                                                                                                                                                                                                                                                     | Planning consequence                                                                                                                                                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exports          | `ExportsApi.createExport(CreateExportRequest)` returns `QueuedJob`; `getQueuedExport(id)` is documented to return queued status or redirect to the export; `getExport(id)` returns `Export`. No `getExports` list method is declared.                                                             | Local routes can start/inspect one known export. “Recent exports” must be explicit workspace/session-local state; never imply platform-wide history.                                                                                                        |
| Export request   | `CreateExportRequest.data.attributes` has `config: CADExportConfig`, optional `fileName`, optional `downloadUrlExpiry`; relationships require `source` of type `scene` and optionally `state` of type `scene-view-state`. `CADExportConfig` declares only `format: string`—no typed enum/options. | Start with exactly one docs-verified format/serializer. No raw config textarea, free string format, guessed enum, or additional options before evidence.                                                                                                    |
| Completed export | `ExportDataAttributes` includes `created`, mandatory `downloadUrl`, optional `downloadUrlExpiry`; its relationship is a `file`. Docs state fetching a completed export can recreate the URL.                                                                                                      | The standard local detail response **must redact `downloadUrl`**. A dedicated click-time action alone may return it with `Cache-Control: no-store`. Do not route it through File download APIs unless a future verified UX requires that file relationship. |
| Documents        | Preview-marked `DocumentsApi.getDocuments({ pageCursor, pageSize, filterSuppliedId })`, `getDocument(id)`, and `createDocument(CreateDocumentRequest)`.                                                                                                                                           | Phase 1 is list/create/get only, capability-labelled. The documented filter is a comma-separated supplied-ID filter—not a guessed contains/raw filter.                                                                                                      |
| Document shape   | Create attributes require `fileId` and optional `suppliedId`; returned fields include `fileId`, `suppliedId`, `documentType` (currently `PDF` in declaration), and `createdAt`.                                                                                                                   | Registering a document is not upload/copy/download. Require a completed eligible File selected through a typed picker; do not add update/delete/download.                                                                                                   |

Reproduce/refresh the support evidence with:

```sh
rg -n '^export declare class (ExportsApi|DocumentsApi)' node_modules/@vertexvis/api-client-node/dist/cjs/api.d.ts
rg -n '(ExportsApi(CreateExport|GetExport|GetQueuedExport)|DocumentsApi(CreateDocument|GetDocument|GetDocuments)|interface (CreateExportRequest|ExportDataAttributes|CreateDocumentRequestDataAttributes|DocumentDataAttributes))' node_modules/@vertexvis/api-client-node/dist/cjs/api.d.ts
rg -n 'CADExportConfig|downloadUrlExpiry|downloadUrl|Preview|filterSuppliedId' node_modules/@vertexvis/api-client-node/dist/cjs/api.d.ts
```

For every local operation, add a handoff row containing: official reference URL
and check date; SDK method/request/response type; resource/path/query/body and
relationship requirements; allowed format/options and numeric/string bounds;
preview/module/permission behavior; queued statuses/error set/redirect behavior;
and exact local route/client/UI consumer. Classify it as supported-and-typed,
typed-but-needs-doc research, preview-gated, or absent. Any SDK/reference gap
requires a separate SDK-upgrade decision—not an untyped Axios fallback.

Specific blockers to resolve from current docs before code:

- The first allowed CAD export `format` string and any required/allowed
  format-specific config fields, filename rules, and min/default/max
  `downloadUrlExpiry`. The installed type is intentionally too broad to infer
  these.
- How Axios/SDK handles a queued-export completion redirect by default, whether
  the redirect includes a relative/absolute Location, and the exact running/error
  statuses/diagnostics. Test that behavior against MockServer, not assumptions.
- Whether document registration requires a File status/type beyond the
  dashboard's existing normalized `complete` predicate, and Preview capability
  error semantics for the target account.

## Route and client shape after the gate

Use resource contracts/adapters under `src/lib/resources/artifacts/` (final
names follow the accepted generator) and preserve direct named handler exports
for tests. Suggested local routes:

| Route                                                | Surface                                                                                                                                     | Why it is custom/generated                                                                                                                                                                             |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /api/exports`                                  | Start a typed export from the current workspace scene/state.                                                                                | Custom action: source/state ownership validation, closed format registry, config serializer, request review fields, queued ID extraction.                                                              |
| `GET /api/queued-exports/[id]`                       | Return normalized `running`, `error`, or terminal export identity/details; never forward an upstream redirect.                              | Custom async action: intercept/normalize redirect and error status safely.                                                                                                                             |
| `GET /api/exports/[id]`                              | Return safe export detail fields (ID, created, file relation, allowed source/state/config fields if returned), with `downloadUrl` stripped. | Custom redacting detail adapter. Do not make it a browser cache source for the sensitive URL.                                                                                                          |
| `POST /api/exports/[id]/download-url`                | Retrieve the export fresh at click time and return only `{ status, url }` with no-store response headers.                                   | Custom one-shot download action, not CRUD. The request is allowed only for a validated opaque export ID.                                                                                               |
| `GET/POST /api/documents`, `GET /api/documents/[id]` | List/create/get documents with typed clients/contracts.                                                                                     | Generator appropriate only after the Preview support matrix is accepted; document hooks own supplied-ID filter/query mapping, file suitability validation, capability presentation, and invalidations. |

Do not add `/api/exports` GET: SDK 0.44.0 has no export-list method. Do not
expose an export `downloadUrl` in an `Export` adapter, SWR key, workspace state,
recent-results list, snackbar, telemetry, copied content, or URL. The browser
temporarily receives the URL only from the click action so it can open it.

## Lifecycle and security hooks

### Export create

The `POST /api/exports` developer-owned operation must:

1. Parse a closed dashboard contract—not `CreateExportRequest` directly. Accept
   only `sceneId`, optional `sceneViewStateId`, one registered `format`, its
   typed validated options, optional constrained filename, and bounded expiry.
2. Verify the authenticated caller can get the supplied scene; if a state is
   supplied, verify its source/owning scene matches the requested scene through
   typed API lookups. Never trust a browser-provided relationship type/ID pair.
3. Serialize the verified input into exactly the SDK `source: { type: "scene",
id }` and optional `state: { type: "scene-view-state", id }` relationships.
   A format registry owns the one verified `CADExportConfig` serializer; unknown
   formats/options are 400 and make no SDK call.
4. Call `ExportsApi.createExport`, normalize the queued ID/status and safe
   diagnostics, and return `202`/established local queued response semantics.
   It must not say “export complete,” include any URL, or auto-retry duplicate
   start requests.

### Queued export polling and redirect resolution

The queued endpoint must poll only while a verified non-terminal status is
returned. Use cancellation/abort plus a workspace-instance revision so a state
change/unmount cannot update another scene's card. Prefer a modest bounded
backoff (for example 2s → 5s → 10s) and retain manual refresh; stop on terminal
success/error/unknown timeout.

`getQueuedExport` is special: completion redirects to an export. Do not let the
browser receive/navigate an upstream Location. The route hook must deliberately
test and implement one safe strategy, such as a no-redirect upstream request
that validates the Location against the configured Platform base path and
expected `/exports/<opaque-id>` shape, then performs a server-side typed
`getExport`. Handle Axios's non-2xx/redirect behavior explicitly. A malformed,
off-host, unexpected or missing Location is a normalized local error—not an
external follow. Return a terminal safe export summary with its ID, never its
download URL. If the installed client auto-follows redirect instead, detect and
normalize the terminal Export response deliberately; cover both documented SDK
behavior and the chosen configuration in a test.

An error queued job maps its `errors` diagnostics through the normal local error
shape. “Try again” returns the dialog to an editable state and creates a _new_
request only after user action; it is not a blind POST retry/idempotency claim.

### Export detail and download

- Every regular `getExport` response is normalized/redacted before serialization.
  Return ID/timestamps/file relationship and only non-sensitive detail fields.
- The download action calls `getExport` again on click, extracts a non-empty
  `attributes.downloadUrl`, validates the export ID/context, sets
  `Cache-Control: no-store`, and sends the URL only to that response. Do not log
  the URL or include it in error text. If retrieval fails/has expired/missing
  URL, return a generic normalized actionable error.
- The UI calls this action only after terminal completion and opens it with
  `noopener`; if popup opening is blocked it uses `window.location.assign` as
  the existing File UI does. It clears transient local URL state immediately
  after the attempt. The configured expiry is visible as a security choice, not
  proof of durable retention.

### Documents Preview

Document hooks use typed `DocumentsApi` calls and preserve `{ status, cursors,
data }` list envelopes. Parse `pageCursor`/bounded `pageSize` and an explicit
comma-separated supplied-ID filter according to the declared SDK contract;
normalize/reject blank/ambiguous values before client acquisition. Create accepts
a verified selected completed File ID and optional constrained supplied ID, then
maps the fixed `{ type: "document", attributes: { fileId, suppliedId } }` body.

Documents UI must carry a Preview badge and capability message. A 403, feature
absence or Preview-unavailable response displays an informative read-only state
without disabling Files or the rest of Artifacts. It must never claim update,
delete, source upload, document download, or export linkage. On successful
creation invalidate the document list/detail and the selected File's related
document summary only if that relationship is later verified and implemented.

## UI and phased delivery

1. **Export adapter/start (after gates):** add a Scene Workspace Exports tab.
   Its dialog pre-populates the selected scene, offers only the selected valid
   view state, one current-doc-verified format and its typed fields, filename/
   expiry constraints, and a human-readable review. Disable duplicate submit.
2. **Queued result/download:** render a workspace-scoped status card and a
   clearly labelled session-local “Recent in this workspace” list. Reuse Core's
   accepted async-status primitive rather than a second polling framework. Add
   terminal safe details, copy ID, manual refresh and click-time download.
3. **Documents (Preview):** add an isolated `/documents` page or Files detail
   Preview tab—not both initially. Prefer a page if a file-detail relationship
   is not SDK-verified. Include typed completed-file picker, list/paging,
   supplied-ID filter, lazy detail drawer, loading/empty/error/capability state.
4. **Later only:** extra formats/options or any document mutation/action needs a
   new support-matrix row, dedicated UX/safety review and regression suite.

No new generic components are justified solely by this group. The export status
card, relationship picker, typed details sections and capability notice must
come from accepted Core/Scene work. Keep the export dialog's format serializer,
redirect resolver and download behavior domain-local—they have security and
request semantics not shared by file archives.

## Focused validation gates

### Node/unit and MockServer

- Export create rejects unsupported format/unknown option, empty/malformed IDs,
  mismatched scene/view-state, invalid filename/expiry and body-shaped error
  bypasses before `getClientFromSession`/SDK call. Valid input verifies the exact
  SDK request relationships/config body and returns a safe queued response.
- Queued export tests cover starting/running/error, duplicate submit guard,
  cancellation, manual refresh, completion through 3xx Location (including
  malformed/off-host Location rejection), and SDK auto-follow behavior if
  applicable. Assert terminal envelopes contain export ID but never a URL.
- Detail/download tests prove normal export get strips `downloadUrl`; only the
  click action extracts it, sends `Cache-Control: no-store`, and maps missing/
  expired/upstream errors without echoing it. Verify file archive download
  behavior remains unchanged.
- MockServer contract tests on Docker-capable CI verify actual `/exports`,
  `/queued-exports/:id`, `/exports/:id` path/method/JSON:API request and
  response/redirect handling, authorization/media headers where needed, 4xx/5xx
  mapping, and no upstream interaction on validation failure. Do not mark these
  passed when Docker is unavailable.
- Documents handler tests verify cursor/default/max page size, comma-separated
  `filterSuppliedId`, get-by-ID, Preview create body, completed-file eligibility,
  403/404/5xx normalization, and no guessed update/delete routes. Use
  MockServer to assert the typed SDK serializes list/create/get as expected.

### Component/JSDOM and Playwright

- JSDOM/MSW: Export dialog defaults the workspace scene; valid state is shown
  only for that scene; format/options validation and review work; double-click
  starts once; status moves queued → terminal/error; refresh/cancel prevents
  stale updates; URL never renders. Documents cover empty/list/filter/paging,
  completed-file picker, create/list invalidation, lazy detail and Preview/403
  state.
- Extend the controlled local e2e harness with local API/upstream fixtures only.
  Smoke export: workspace fixture → review → create → running queued fixture →
  terminal redirect/export fixture → click Download. Record the local request
  body/relationships and assert no URL/history/DOM/local/session storage text
  contains the fixture download URL before or after action. Add queued error →
  corrected new submission. The fixture must reject any outbound Vertex host.
- Smoke Documents: Preview page starts empty → create from a completed file →
  detail/list row → supplied-ID filter; then exercise 403/Preview unavailable.
  Assert UI exposes no delete/update/download control. Run archive collection
  Playwright tests alongside this group to prove shared async presentation did
  not regress current file-job flow.

Before independent review run `yarn format` (review resulting diff), `yarn
lint`, `yarn test:ci`, `yarn api:generate:check`, `yarn test:e2e`, and `yarn
build`. Attach command results, Docker/port/browser limitations, SDK/docs
matrix, exact fixture behavior and URL-redaction evidence to the validation
handoff. An unavailable gate is not a pass.

## Implementor checklist

- Accepted Core and Scene commit IDs plus stable shared component APIs.
- Fresh docs-to-SDK matrix with a verified first export format and expiry bounds.
- Explicit redirect strategy tested against the actual 0.44.0 Axios behavior.
- Exact local route contracts and generated/custom ownership boundaries.
- URL-redaction/no-store threat-model checks and controlled fixture plan.
- Preview Documents capability copy and a list of intentionally absent document
  operations.

If any item is missing, return to research rather than adding a generic config
form, exposing the completed export URL in regular data, or approximating a
Preview endpoint.
