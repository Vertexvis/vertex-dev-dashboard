# Core import and library completion — UX research handoff

## Objective and boundary

This is the first post-framework API group. It should turn the existing developer workflow—**file → uploaded source → part/revision translation → inspect/use result**—into a dependable library workspace, rather than adding a generic API console.

In scope: `files`, `file-collections`, `file-jobs`, `parts`, `part-revisions`, `part-renditions`, `part-revision-instances`, `geometry-sets`, and `translation-inspections` from the [official Vertex Platform API reference](https://docs.vertex3d.com/). The current SDK pin is `@vertexvis/api-client-node@0.44.0`; this fresh worktree has no installed dependencies, so the implementor must first install it and make an explicit per-operation support matrix. If documented operations are absent from the pin, create a separate SDK-upgrade decision/PR; do not hide the mismatch with untyped client calls.

Out of scope: scene composition/viewer work, exports/documents, properties/search, collaboration, and account administration. Geometry-set completion should stop at source management/inspection; using it in a scene belongs to the Scene group.

## What already works and should be retained

- `/files` supplies cursor paging, sortable table columns, debounced name/file-ID/supplied-ID filters, date-range filtering, selection, delete, download, a details drawer, and an upload/create dialog. `src/lib/paging.ts`, `src/lib/query-filters.ts`, `TableToolbar`, `TableHead`, `RowActionsMenu`, `DataLoadError`, `SkeletonBody`, and `CreatedAtDateRangeFilter` are the compatibility baseline.
- File creation is a multi-step flow: create a file resource, then multipart upload through `/api/upload`, with an optional hand-off to `/parts?create=...`. Files are only downloadable after their status is `complete` (`CreateFileDialog`, `FileTable`).
- `/file-collections` has resource list/detail and a dedicated collection-files view; it can create/archive a ZIP through a file-job and poll the job (`file-collections/[fileCollectionId].tsx`, `pages/api/file-jobs*`).
- `/parts` has a part table, selection/delete, a file picker and typed part-create dialog, lazy revision detail drawer, and running/complete/error translation panels (`PartTable`, `CreatePartDialog`, `PartRevisionDetailsDrawer`, `TranslationTables`).
- Server calls are the security boundary: local Next routes are wrapped with `withSession` and create the authenticated SDK client with `getClientFromSession`. Preserve this; React must never directly construct `VertexClient` or receive a bearer token/client secret.

## Developer UX: resource priorities and operations

### 1. Files — complete the source-file lifecycle

Keep the existing list as the landing table. Add an edit dialog/details action for updateable metadata, name, expiry, and supported supplied-ID fields; retain the existing query/filter/sort affordances. Show explicit, normalized state chips (`uploading/pending/running`, `complete`, `error/failed`, unknown) and gate actions based on state:

- **Create → upload:** preserve it as a clear two-step progress flow with error recovery. A user must see whether resource creation succeeded even if binary upload fails, so they can retry upload rather than create a duplicate.
- **Download URL:** available only after the API reports a usable file; label it as a short-lived generated URL and retain failure snackbar feedback.
- **Create part / add to collection:** offer row actions only for compatible/complete files. The part action should prefill the existing Create Part dialog; the collection action opens an association picker.
- **Details:** include metadata, expiry, root file name, size, status/timestamps, and linked file collections. Use lazy loading as the current details drawer does.
- **Delete:** use an explicit confirmation dialog that names the selected resources and warns about dependent parts/collections; do not assume a bulk request is atomic.

### 2. File collections and file jobs — make reusable import bundles

The collection list should gain update (metadata/expiry/name as API permits) and an **Manage files** workspace. In that workspace, show current member files with status, add a searchable/paginated eligible-file picker, remove selected members, and make archive export a prominent asynchronous operation.

- **Create/get/update/delete collection; list/add/remove members; list a file's collections** are the core operations. Keep collection membership visible from both file and collection details so developers can trace source reuse.
- **Create archive file job → poll get file job → download archive:** show a compact job/status card with job ID, output file, last status, retry/poll control, terminal error, and download action only when complete. The archive UX must explain when it is disabled (empty collection or member not complete); current `getFileCollectionExportAvailability` already captures this logic.
- For destructive removal/delete, distinguish “remove from this collection” from “delete the source file,” and require confirmation only for the latter. Membership changes should invalidate both collection and file detail caches.

### 3. Parts, revisions, renditions, instances — inspect translation output

Keep the Parts Library as a table with expandable/linked revision rows. It should let a developer:

- **Create/list/get/delete part** from a selected completed file, using the typed source relationship and supplied IDs.
- **List/get revisions under a part** and lazy-load detailed fields/metadata on selection. Display revision translation state/queued-job linkage when available.
- **Inspect renditions and part-revision instances** as nested read-only tabs or a details drawer at first. Show IDs, source/relationship targets, supplied identifiers, timestamps/status, and metadata/transform summaries; use a copy-ID action. Add creation/update/delete only after the SDK/reference matrix confirms those documented operations and their required relationship bodies.
- **Geometry sets:** add a compact Source/Geometry Sets subsection: list/get/create from a selected compatible completed file and inspect its source/status. Avoid a raw JSON form and do not place it in the main Parts table; it is an alternate import product that leads into later scene work.
- **Queued translation inspection:** replace the current ID-only panels with status, resource/source, created/updated, error/message and a link back to the affected part/file when relationships permit. Poll only running jobs (10–30 seconds); completed/error views should refresh manually or at a modest interval.

## Required custom lifecycle overrides

The framework can generate conventional JSON:API list/get/create/update/delete routes and SWR list/detail mutations. These operations require declared typed overrides, not generator guessing:

| Area                               | Required override                                                                                                        | Why                                                                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| File upload                        | `afterCreate` starts upload; multipart handler/storage engine and retry/progress response                                | Binary upload is not JSON:API CRUD and must keep the server credential boundary.                                             |
| File list and availability         | list-query/filter/sort mapper; response availability predicate                                                           | Existing API-client filter support is incomplete (custom Axios queries are used); download/create-part must be status-gated. |
| File download                      | custom action creates a short-expiry download URL then returns only the URL                                              | It is an action endpoint, not a resource update; URL must not be persisted.                                                  |
| Collection membership              | relationship input mapper, paginated candidate selector, cache invalidation fan-out                                      | Add/remove are collection-specific relationship operations; file and collection data become stale together.                  |
| File archive job                   | `beforeAction` validates every member and name; orchestration creates archive file then job; poll/terminal-result mapper | It crosses files, collections, and file jobs, and is asynchronous/non-atomic.                                                |
| Create part / geometry set         | dependent-resource source picker and relationship-body mapper; completion predicate                                      | Source files must be selected by ID and checked for suitability/completion.                                                  |
| Revision/rendition/instance detail | parent-context route builder, lazy field-selection and response normalizer                                               | APIs are nested/relationship-heavy; metadata/large fields should not bloat list calls.                                       |
| Translation jobs                   | status filter mapper, polling policy, resource link resolver                                                             | Running jobs require refresh; terminal/error treatment and related-resource navigation are domain-specific.                  |

## Permissions, safety, and asynchronous behavior

- All operations run with the signed-in application's account-scoped authorization. Access may be denied per resource/operation; render the API error in context and do not infer that list permission grants mutation permission.
- Treat file, file collection, and part deletion as irreversible from this dashboard. Require confirmation that lists IDs/names; after a partial bulk failure, report individual failed IDs and refresh rather than showing blanket success.
- Collection removal is not deletion. Make the scope clear in the confirmation text and do not silently cascade to source files.
- Uploads are potentially long running. The server currently configures a 500 MB Multer limit, while the dialog says “up to 1MB”; research/implementation must reconcile that user-facing discrepancy before changing the workflow. Do not claim platform format/size compatibility without the current Import Data docs.
- File jobs and translations are asynchronous. Start actions should return an ID and immediate “queued” feedback; poll only while non-terminal; include terminal error text and a manual refresh/retry affordance when the API supports retry. Never optimistically label a job complete.
- Generated download URLs and any temporary upload targets are sensitive/short lived: return them only to the initiating browser flow, do not log them, add them to SWR/cache, or render them in a table/details drawer.
- Metadata and supplied IDs can originate externally. Display them as text (never HTML), enforce current API field limits from SDK/reference validation, and use typed inputs rather than exposing arbitrary raw request bodies.

## Framework/implementation instructions

1. Install dependencies and write the operation-support matrix from the pinned SDK and docs before source implementation. Record unsupported operations in the implementation handoff.
2. Migrate one existing low-risk read-only list/detail resource through the framework first and prove its cursor/filter/sort/SWR behavior with existing tests. Files is a good candidate only if the custom list-query override preserves its current filters exactly.
3. Add shared primitives only where three or more resources use them: `ResourceDetailsDrawer` sections, `AsyncJobStatusCard`, `RelationshipPicker`, `ConfirmDestructiveAction`, and resource-operation error feedback are justified. Keep upload and archive orchestration explicit overrides.
4. Preserve route contracts while migrating. For example, existing components expect `{ status, data, cursors }` envelopes and `Failure`-derived errors; do not switch client contracts wholesale in this group.
5. Add/extend MSW route tests for every generated operation and each custom override. Component tests need: cursor navigation, debounced filters, empty/error states, disabled availability action, upload-create failure split, destructive confirmation/partial failure, membership mutation invalidation, and queued→terminal job UI transitions.
6. Validator Playwright smoke path (using controlled API mocks when credentials are absent): create a file, upload/retry error path, wait/refresh a non-complete→complete file, make a part and observe queued translation, inspect revision, create/manage a collection, start/archive-poll/download action, and verify that delete/removal confirmation has the correct scope.

## Hand-off questions the implementor must resolve from SDK/docs (do not guess)

- Exact CRUD/action support and request types in `0.44.0` for `part-renditions`, `part-revision-instances`, `geometry-sets`, and individual queued translation/job retrieval.
- Which file/part/geometry-set state values and relationships are authoritative for each action gate, and whether collection membership permits files that are not complete.
- Exact mutation fields for files and file collections, update semantics for metadata key deletion, and whether supplied IDs are immutable.
- Which actions are asynchronous and their terminal statuses/redirect behavior; whether the API has a supported retry operation versus a new job only.
- Required roles/scopes and any account-feature availability constraints, particularly for geometry sets.
