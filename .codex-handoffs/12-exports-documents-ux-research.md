# Exports and documents — UX research handoff

## Scope and source constraints

This group adds a focused **Artifacts** workflow after Scene Workspace: create a downloadable export of a scene (optionally from a saved scene view state), follow its queued result to completion, and register/inspect source-file documents. It is for developers validating integration outputs—not a general document-management system.

Official reference evidence: [Vertex Platform API](https://docs.vertex3d.com/).

- `POST /exports` is asynchronous and returns the location of a `queued-export`; `GET /queued-exports/:id` returns status while running/error and redirects to the created export on completion; `GET /exports/:id` retrieves it.
- An export request has a required format/config, optional result filename and download-URL expiry, a required scene source relationship, and optional scene-view-state relationship.
- `documents` supports list with supplied-ID filtering, create from a file ID plus optional supplied ID, and get by ID. The docs label the document API **Preview**, so it must be feature-labelled and isolated from stable Export behavior.
- The pinned SDK is `@vertexvis/api-client-node@0.44.0`, with no installed declarations in this worktree. Before source implementation, install it and write a per-operation support matrix for Export/QueuedExport/Document types, response links, redirect behavior, validation enums/configs, and error models. Do not paper over SDK gaps using untyped calls; decide on a separate SDK upgrade if needed.

## Existing UX and code to preserve/reuse

- Scene Workspace already knows selected scene, active scene view and view state; it is the natural entry point for creating scene exports. Do not require a user to paste source IDs.
- The existing File Collection archive flow is the model for a long-running output operation: it calculates readiness, disables invalid starts, creates an operation, polls a local route only while running, handles errors/retry, and creates a short-lived download URL only after completion (`pages/file-collections/[fileCollectionId].tsx`, `pages/api/file-jobs*`, `lib/file-jobs.ts`).
- File Details/Files already provide an authenticated server-side generated download URL and open it in a new tab with `noopener` (`pages/api/files/[id]/download-url.ts`). Reuse that security boundary and error UI pattern, but do not force export results through File APIs unless the verified export response actually provides a file relationship.
- Reuse existing MUI list/table/detail patterns, cursor paging, `RowActionsMenu`, `TableToolbar`, `DataLoadError`, `SkeletonBody`, `ResourceLink`, SWR invalidation, and the core group’s proposed `AsyncJobStatusCard`, `RelationshipPicker`, typed details sections, and confirmation/error-feedback primitives.
- No current page or route exposes Platform `exports`, `queued-exports`, or `documents`; adding them must not alter the file-collection archive behavior or its public local route contracts.

## Recommended developer workflow and API grouping

### A. Scene export: primary workflow

Add an **Exports** tab to the Scene Workspace with a quick `Create export` action from the selected scene. The dialog should prefill the selected scene and, when present, permit a saved scene view state to be included. Inputs should be deliberately small and typed:

- Export format selected from a verified SDK/docs-backed registry; show only format-specific options that are implemented and validated.
- Optional artifact filename with clear server/API constraints, and an explicit bounded download-link lifetime.
- Source scene and optional state summarized as links/IDs; do not offer arbitrary resource types.
- A compact request review (source, state, format/options, filename, expiry) before submission.

After submit, show an Export status card in the workspace and a dedicated **Recent exports** list scoped to the current scene. Status must distinguish `starting`, `queued/running`, `complete`, `error`, and `unknown/refresh needed`. Completion offers `Download result`; details show artifact ID, source/state, chosen config, timestamps and server-provided diagnostics. The user can copy an ID and manually refresh. If current docs/SDK support only lookup by ID—not an export collection list—the “recent” list is session-local/route-state only and must be labelled as such; do not invent a platform-wide list endpoint.

The download action must request/obtain a fresh result URL only at click time, open it with `noopener`, and never retain it in SWR, browser storage, a table cell, logs, or a shareable route. The configured `downloadUrlExpiry` governs validity on retrieval; show it as a security/expiry choice, not durable artifact retention.

### B. Documents: source-file registration and inspection

Provide a small **Documents (Preview)** page or a Files detail sub-tab, gated behind a preview badge and clear capability/error state. The developer workflow is:

1. Start from a completed File or the Documents list’s typed file picker.
2. Create a document with source file ID and optional supplied ID.
3. List documents with cursor paging and supplied-ID filter; open a lazy details drawer for document ID, supplied ID, source file link and all verified response fields.

Because the official reference labels Documents Preview and only establishes list/create/get here, phase one must be read/create only. Do not imply update/delete/download, associate documents with a scene export, or build a rich editor unless the installed SDK and current docs establish those contracts.

## Phased delivery

1. **Export framework adapter and direct scene start.** Local typed routes for create queued export, get queued export, get export; reusable queued-resource state mapper; source/state relationship picker from Scene Workspace; format configuration registry with one verified safe format. Preserve no raw config textarea.
2. **Completion and download UX.** `AsyncJobStatusCard` routing/polling/error/refresh behavior, completed-export details, safe click-time download handling, and scoped recent-results state. This phase must correctly model HTTP redirect or equivalent SDK result returned by queued-export completion.
3. **Documents Preview.** Local list/create/get routes and minimal list/detail/create UI, file relationship picker from the Core Library group, capability/preview labelling and feature-unavailable state.
4. **Only if verified later:** additional documented export formats/options or any document operation not confirmed above. Each extension needs an updated support matrix and separate tests; do not grow this PR with the larger Export/document lifecycle group.

## Framework generation versus explicit lifecycle hooks

| Resource/action    | Routine framework contribution                                   | Required typed override                                                                                                                                             |
| ------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Export lookup      | local get-by-ID response/error envelope if SDK supports it       | normalize/export only safe detail fields and any eventual-result download link; resolve source/state labels.                                                        |
| Create export      | typed action route, request validation, mutation status envelope | scene-only source and optional state relationship mapper; allowlisted format-specific config serializer; filename/expiry validation; queued location/ID extraction. |
| Queued export      | local get-by-ID envelope                                         | polling policy; HTTP redirect/SDK redirect normalization to terminal export; status/error mapping; abort/cancel stale polling when source workspace changes.        |
| Export download    | none—do not model it as CRUD                                     | click-time fresh URL/result extraction, expiry handling, redaction/no-cache policy, popup-blocker fallback and failure feedback.                                    |
| Documents list/get | generated paging/filter/get route if SDK support is proven       | supplied-ID filter mapper; response normalizer; Preview/capability status treatment.                                                                                |
| Create document    | generated typed create envelope                                  | completed-file relationship picker and body mapper; source-file suitability check; invalidate file and document views.                                              |

No browser-supplied dynamic operation, URL, resource type, relationship type, or arbitrary JSON configuration may be forwarded to Platform. Metadata must declare known operations, allowed config fields, type guards, serializers and cache invalidations. The local Next route remains the OAuth client-credential boundary.

## Async, safety, and permission policy

- Exports are not immediate. A 2xx create response means a queued export was accepted—not that an artifact exists. Poll only while a known non-terminal state is returned, use bounded/backoff intervals, offer manual refresh, stop polling after route/source change or terminal response, and preserve the queued/export ID for recovery.
- Queued-export completion redirects to the created export according to current docs. The server adapter must deliberately handle this rather than exposing an upstream redirect/browser navigation. Verify the SDK/HTTP client’s redirect default and retain access to the terminal export ID/body.
- A failed/export-error result should show server diagnostics safely and let the user submit a _new_ export after editing inputs. Do not blindly retry a POST, since duplicate artifacts/costs may result and request idempotency is not established here.
- Export format/config controls potentially cause substantial work or output. Constrain numeric/enum values from verified schemas, show an input review, and require confirmation for high-cost/large-output modes if those are later added. Do not advertise formats based on guesses from Postman examples.
- Result URLs are sensitive short-lived URLs. Return them only to the initiating browser action; never include them in list/detail SWR payloads, telemetry, snackbar text, copied data or query strings. Follow `noopener` and provide a same-window fallback only if popup creation is blocked.
- Documents are Preview and may be absent from an account/role. A permission/module/feature error must render a clear non-destructive state and leave Files/Scene Workspace usable. Registration is not an upload or a copy of the source file; make that distinction visible.
- Use account-scoped permissions per local session. Do not treat authorization to list/get as authority to create exports/documents. All Platform errors must use existing normalized `Failure`/`toErrorRes`-style local responses.

## Validation requirements

### Unit and route coverage

- Test supported-method enforcement, authenticated client acquisition, strict request schema/allowlists, source/state relationship validation, filename/expiry bounds, format-specific serializer errors, unknown config keys, and normalized API failures.
- Model queued-export state sequences: accepted → running → redirect/completed export; accepted → error; network/redirect parsing failure; workspace/source switch abort; explicit manual refresh; duplicate-submit prevention.
- Test download redaction: route response/state does not retain a result URL after action; error/popup-blocker fallback works; expiry failure is actionable.
- Test document list cursor/supplied-ID filter, create requires verified file ID, Preview capability/403 state, and cache invalidation after creation.

### Component and Playwright coverage

- Scene Workspace export dialog defaults selected scene, can include only a valid selected view state, validates a supported format/options, shows review, prevents double start, then moves through queued/complete/error states without reporting premature success.
- Controlled backend smoke: create export → poll queued endpoint → simulate terminal redirect/export → download action; verify only a click causes a result URL request and no rendered UI/history string contains it. Repeat with queued error and recovered new submission.
- Documents smoke: list empty → create from completed file → row/detail visible → supplied-ID filter → simulated Preview/permission unavailable message. Verify no UI claims delete/update/download that is not supported.
- The validator should inspect actual API request shapes (including scene/state relationship and `downloadUrlExpiry`), component state, and browser view; run alongside existing file-archive tests to prove the generic async work has not regressed current export-like behavior.

## Mandatory support-matrix questions

1. Exact `0.44.0` API class/method names and response types for create/get export, queued export, response redirects, and list/get/create document.
2. Exact Export config formats/options and validation constraints supported by the installed client/current docs; choose the first UI format only from that evidence.
3. Completed export response shape: whether/how it supplies a download URI or a distinct action, field names, default/max `downloadUrlExpiry`, and whether a new retrieval regenerates expiry.
4. Queued-export statuses/error shape, redirect handling, retry/idempotency semantics, polling recommendations, and authorization/feature requirements.
5. Document resource fields and whether the only supported relationship is a completed Vertex File; exact Preview availability/permission errors and whether any update/delete/download operations exist.
6. Whether an exports list endpoint exists in the current API/SDK. If not, retain an explicitly scoped local recent-run UX rather than implying global history.
