# Core import and library completion — engineering plan

## Delivery gate and non-goal for this handoff

This is the first group **after** the framework PR. Do not begin core-group
product code, add `api-resources.json` entries, or migrate existing routes until
the framework PR is independently validated and its generated-output check,
route lifecycle tests, and first reference migration are accepted. This group
must be a draft stacked PR whose base is that accepted framework branch.

The group extends the developer import workflow—source file → completed file →
part/translation → inspect library output—rather than creating a generic Vertex
API console. Keep the Pages Router API layer as the credential boundary:
components request same-origin `/api/...` only; `withSession` and
`getClientFromSession` remain responsible for session/client construction.

No root `middleware.ts` is required or appropriate. The framework's route
lifecycle is the middleware extension point for this Pages Router application.

## Compatibility baseline to preserve

| User surface           | Existing implementation to retain                                                                                                                                                                                                                 | Contract that must not change during migration                                                                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Files                  | `src/pages/files.tsx`, `src/components/file/FileTable.tsx`, `CreateFileDialog.tsx`, `FileDetailsDrawer.tsx`, `src/pages/api/files.ts`, `files/[id]/download-url.ts`, and `files/[id]/file-collections.ts`.                                        | `/api/files` keeps `{ status, cursors, data }`; file list keeps cursor paging, created/name/file-ID/supplied-ID filtering and `name`/`created` sorting; download stays a one-use action and completed-file-only action. |
| Upload                 | `src/pages/api/upload.ts` and `src/lib/multer/api-storage-engine.ts`.                                                                                                                                                                             | Streaming Multer route retains `bodyParser: false`, the server-side iron-session application, and no browser credential access. It is an explicit workflow action, not generated JSON CRUD.                             |
| Collections            | `src/pages/file-collections.tsx`, `components/file-collection/FileCollectionTable.tsx`, `FileCollectionDetailsDrawer.tsx`, `FileCollectionFilesTable.tsx`, and `src/pages/file-collections/[fileCollectionId].tsx`.                               | Collection list/detail URLs and envelopes remain stable. Keep lazy detail fetching, file drawer links in both directions, and `includeExportAvailability` behavior.                                                     |
| Archive jobs           | `src/lib/file-collections.ts`, `src/lib/file-jobs.ts`, `pages/api/file-jobs.ts`, `pages/api/file-jobs/[id].ts`, and the collection detail page's readiness/polling state.                                                                         | Archive creation first proves all member files are exportable, creates the archive file, then creates the job. It must not be reduced to generic `POST /file-jobs` CRUD or optimistic completion.                       |
| Parts/revisions        | `src/pages/parts.tsx`, `components/part/PartTable.tsx`, `CreatePartDialog.tsx`, `PartRow.tsx`, `PartRevisionDetailsDrawer.tsx`, and `pages/api/parts.ts`, `part-revisions.ts`, `part-revisions/[id].ts`.                                          | Existing part creation keeps its typed file relationship; revision details remain lazy and list/detail return their current shapes. Preserve the current scene handoff from a revision.                                 |
| Translation inspection | `src/pages/translations.tsx`, `components/translation/TranslationTables.tsx`, `QueuedTranslationsTable.tsx`, `src/lib/queued-jobs.ts`, and `pages/api/queued-translations.ts`.                                                                    | The initial translated view remains status-oriented, while polling only runs for non-terminal work. Do not make all list pages poll.                                                                                    |
| Shared conventions     | `src/lib/api.ts`, `paging.ts`, `query-filters.ts`, `query-params.ts`, `sorting.ts`, `with-session.ts`, `vertex-api.ts`; `TableHead`, `TableToolbar`, `RowActionsMenu`, `DataLoadError`, `SkeletonBody`, `CreatedAtDateRangeFilter`, and `Layout`. | Retain public `Res`/`ErrorRes`/`GetRes` shapes, deterministic `buildQuery` ordering, cursor state behavior, common error conversion, and existing MUI layout/accessibility conventions.                                 |

The current code contains error-path weaknesses (for example some mutations clear
selection or parse a JSON body before validation). The framework migration is
the opportunity to improve them, but success behavior and route contracts must
remain backward compatible and each change requires the regression coverage in
the validation handoff.

## SDK/reference verification: required before endpoint work

The pinned package is `@vertexvis/api-client-node@0.44.0`. No `node_modules`
directory exists in this research worktree, so no support claim is made here for
new resource families. The implementor must complete this matrix before writing
a resource hook or UI for an operation not already exercised in the source.

1. Run `yarn install --frozen-lockfile`; record Node/Yarn versions and the
   resolved package version from `yarn.lock`.
2. Inventory exported APIs/types and their declaration locations, rather than
   relying on endpoint names:

   ```sh
   rg -n "class (FilesApi|FileCollectionsApi|FileJobsApi|PartsApi|PartRevisionsApi|PartRenditionsApi|PartRevisionInstancesApi|GeometrySetsApi|TranslationInspectionsApi)" node_modules/@vertexvis/api-client-node
   rg -n "(get|list|create|update|delete)[A-Z].*(File|FileCollection|FileJob|Part|PartRevision|PartRendition|PartRevisionInstance|GeometrySet|QueuedTranslation)" node_modules/@vertexvis/api-client-node
   rg --files node_modules/@vertexvis/api-client-node | sort
   ```

   Adapt the paths/patterns to the package's generated declaration layout; keep
   the actual class/method/type names in the support matrix, not inferred ones.

3. For each candidate operation, compare the actual TypeScript request/response
   type against the current official reference/Postman folder. Record: resource
   and operation; SDK class/method and request type; JSON:API resource type;
   required path/query/body/relationship fields; pagination/sort/filter fields;
   asynchronous/terminal status behavior; permissions/module/preview notes; and
   a source link/date for the reference verification.
4. Classify every operation as **supported and typed**, **typed but behavior
   unclear** (research before implementation), **reference-only / absent in
   0.44.0**, or **SDK gap with a documented raw JSON:API fallback already used
   by this dashboard**. Raw Axios is allowed only for a reviewed, narrow gap
   such as the existing file/collection list filter workarounds, with explicit
   URL/header/request tests. It is not a substitute for a missing resource API.
5. For an absent/newer SDK operation, stop the group at that phase and create a
   separate SDK-upgrade decision/PR. Do not add `any`, guessed request bodies,
   client-controlled endpoints, or untyped generic proxy code.

Commit the completed matrix to the implementation handoff. At minimum it must
resolve these questions: file and collection PATCH fields/metadata deletion
semantics; collection create/update/member-add/member-remove methods; file-job
and queued-translation terminal/status shapes; part-revision, rendition, and
instance read/mutation support; geometry-set source relationship and status
fields; supported file states for part/collection/geometry actions; and any
required scopes/module gates.

## Planned endpoint scope and ordering

Only mark a row implementable after the support matrix and framework gate above
are complete. “Route” is the dashboard API route/adaptor target, not permission
to assume a particular upstream SDK method exists.

| Phase                                        | Scope                                                                                                                                                                                                                         | Route/component target                                                                                                                                                                             | Lifecycle/implementation note                                                                                                                                                         |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 — parity fixture                           | One existing low-risk resource already selected by the framework implementor.                                                                                                                                                 | Follow the accepted framework reference migration.                                                                                                                                                 | Core work does not choose a second reference migration or alter framework behavior.                                                                                                   |
| 1 — preserve and harden existing import flow | Files list/create/delete, binary upload, download URL, file-to-collection list; collection list/get/delete/list-members; archive create/get job; parts list/create/delete; revision list/get; queued-translation status list. | Migrate only already-proven route behavior to the generated route/client patterns. Retain current pages and component entry points.                                                                | This phase proves custom list query, action, relationship, multi-call, and polling overrides without broad new API breadth.                                                           |
| 2 — library UX completion where SDK-verified | File and collection create/update fields; collection Manage Files add/remove; a filtered eligible-file picker; improved file/part/collection details; translation/job status metadata and links.                              | Prefer extending `/files`, `/file-collections`, `/file-collections/[fileCollectionId]`, `/parts`, and `/translations`; add narrowly named nested action routes only after a typed contract exists. | Membership mutations invalidate collection members, collection detail/list, file detail, and any eligible-file query. Update forms use typed field allowlists, not editable raw JSON. |
| 3 — read-only translation-output inspection  | Part renditions, part-revision instances, and geometry sets: list/get and compact detail views only when verified.                                                                                                            | Put rendition/instance inspection beneath a selected part revision (drawer tabs/sections) and geometry sets in a separate source subsection/page, not the main Parts table.                        | Parent IDs are required typed path/context inputs. Lazy-load details and normalize relationship-heavy data before rendering.                                                          |
| 4 — only with evidence                       | Mutation UI for revisions/renditions/instances/geometry sets, retries, or any API action not confirmed above.                                                                                                                 | A new focused dialog/action route per verified operation.                                                                                                                                          | Defer by default. Require documented request relationships, permission/safety review, MockServer contract tests, and an explicit UX decision.                                         |

Do not fold a package upgrade, framework redesign, exhaustive API surface, or
scene composition into this stacked PR.

## Resource-specific lifecycle override map

The new framework should generate only conventional, declared resource wiring.
Place the following semantics in developer-owned `*.hooks.ts`/custom action
modules (names may follow the framework's accepted final contract). Do not add
resource-name conditionals to the generic dispatcher.

| Resource/workflow                        | Needed route lifecycle / adapter override                                                                                                                                           | Existing precedent and acceptance detail                                                                                                                                                                                                                                                                                                |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| File list                                | Typed `transformQuery`/raw-list executor with allowlisted `name`, `fileId`, `suppliedId`, `createdAt` range, cursor/page size, and `name`/`created` sort.                           | `pages/api/files.ts` builds JSON:API parameters and explicit bearer/Accept headers because SDK filter support is insufficient. Preserve exact current filter semantics and reject/ignore unallowlisted sort according to the accepted framework contract.                                                                               |
| File create → upload                     | A workflow adapter that returns the created resource ID, then invokes the existing multipart action; clear separation of create success and upload success/failure.                 | `CreateFileDialog.tsx`, `api/upload.ts`, and the Multer storage engine. The hook must not put binary stream handling in generated JSON parsing. Return a retryable upload state if creation succeeds but upload fails; reconcile the UI's “1MB” text with the server's 500 MB limit from authoritative product docs before changing it. |
| File availability/download               | Response normalizer/status predicate and `POST` action that obtains the short-lifetime URL.                                                                                         | `lib/files.ts` only recognizes normalized `complete`; `files/[id]/download-url.ts` uses a 30-second URL. Keep URLs out of SWR/cache, tables, logs, and long-lived component state; gate download and dependent actions from verified status data.                                                                                       |
| File delete                              | Validated bulk input plus per-ID result/error normalization.                                                                                                                        | Current route uses `makeCall`, but consumers do not distinguish partial failures. The override must give the UI enough structured result to retain/reselect failed IDs and refresh stale data; require named confirmation before server call.                                                                                           |
| Collection list/detail                   | Custom JSON:API list-query transform plus a detail `afterCall` enrichment only when `includeExportAvailability=true`.                                                               | `pages/api/file-collections.ts` is another raw list fallback; `file-collections/[id]/index.ts` calls `fetchAllFileCollectionFiles` only for readiness. Never make the normal list N+1 or fetch every member page.                                                                                                                       |
| Collection membership                    | Typed parent path parser, add/remove relationship-body mapper, candidate eligibility query, and mutation invalidation fan-out.                                                      | Reuse `FileCollectionFilesTable` rendering and file detail's reverse collection loading. Adding/removing must clearly mean membership only, never source-file deletion.                                                                                                                                                                 |
| Archive job                              | `beforeCall` readiness check; custom orchestration executor that creates output file then archive job; result mapper with job and archive file IDs; terminal-status polling policy. | `lib/file-jobs.ts`, `api/file-jobs.ts`, and the detail page. Recheck readiness on the server immediately before creation; do not trust a stale browser button. A failed archive-file creation/job start must return a normalized error and never claim the job began.                                                                   |
| Part create                              | Source-file relationship mapper plus verified complete/compatible-file predicate; client mutation invalidation and job-link response map.                                           | `CreatePartDialog` and `pages/api/parts.ts` construct `source: { data: { type: File, id } }`. Keep scene creation from revision separate.                                                                                                                                                                                               |
| Part revision/rendition/instance details | Parent-context parser, sparse/lazy field query (only if SDK/reference supports it), and response normalizer for attributes/relationships.                                           | `PartRow` lists revisions lazily; `PartRevisionDetailsDrawer` fetches detail lazily. Do not expand list payloads merely to fill a drawer.                                                                                                                                                                                               |
| Geometry set                             | Dedicated source/relationship mapper and source suitability predicate.                                                                                                              | There is no current component precedent; begin read-only/list/get only after support verification, then a specific creation form if supported. It must not become a generic JSON form or Scene workflow.                                                                                                                                |
| Translation inspection                   | Status filter mapper, terminal predicate, bounded polling policy, and best-effort related-resource link resolver.                                                                   | `queued-translations.ts` and `QueuedTranslationsTable` currently expose IDs/created time. Poll only running/non-terminal status (10–30 seconds); terminal success/error remains manual or modest refresh. Unknown states show as unknown—not success.                                                                                   |

All route overrides retain the accepted framework execution order: allowed-method
check, authenticated client/session construction, typed path/query/body parsing,
validation, transformation, custom call, response transformation, normalized
error mapping, response. Hooks may short-circuit safely, but cannot expose a
token, return arbitrary upstream headers, or convert an internal exception to
success.

## UI/component plan

### Reuse before extracting

- Keep each existing page's authenticated `getServerSideProps` pattern:
  `defaultServerSideProps` for standard pages; the collection detail page's
  `withIronSession(serverSidePropsHandler, CookieAttributes)` when it needs
  server-side resource loading/404 mapping.
- Continue dynamically importing the table-heavy components with `ssr: false`
  where existing pages do so. Do not change global SWR behavior in `_app.tsx`.
- Reuse `buildQuery`, `useCursorPagingState`, `TableHead`, `TableToolbar`,
  `RowActionsMenu`, `DataLoadError`, `SkeletonBody`, `CreatedAtDateRangeFilter`,
  `ResourceLink`, and `Layout` for list/detail interaction consistency.
- Preserve right-drawer selection/lazy load: files use `FileDetailsDrawer`,
  collections use `FileCollectionDetailsDrawer`, and revisions use
  `PartRevisionDetailsDrawer`. New rendition/instance data belongs in the
  selected revision's drawer tabs/sections, not a fourth top-level table.
- Keep `FileCollectionFilesTable` as the member-list starting point. Add a
  visible “Manage files” mode and eligible-file picker around it rather than
  duplicating another file table.

### Shared abstractions justified by three-or-more core uses

Create these only after their first three consumers have matching tests and
interfaces. Keep them presentational/small; do **not** build a universal resource
table, CRUD form, or generic workflow engine.

| Candidate                   | First consumers                                                                                  | Narrow contract                                                                                                                                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ConfirmDestructiveAction`  | File deletion, collection deletion/member removal, part deletion.                                | Modal requiring an explicit intent; accepts resource label/IDs, action verb, warning, `onConfirm`, busy/error state. Membership removal supplies a distinct “remove from collection” message; it must never reuse “delete file.”        |
| `ResourceStatusChip`        | Files list, collection-member file list, archive job, translation jobs, and later geometry sets. | Maps a verified normalized status to visual severity and accessible text; unknown stays neutral. It must not decide action eligibility—the resource-specific predicate does that.                                                       |
| `DetailsSection` primitives | File details, collection metadata details, revision/rendition/instance/geometry detail sections. | A display-only field/metadata/copy-ID layout with text escaping/wrapping and loading/error slots. Keep domain field selection and relationship navigation in callers.                                                                   |
| `RelationshipPicker`        | Create Part file selection, collection eligible-file add flow, geometry-set source selection.    | Server-paged, search/filterable selection list exposing a typed ID/label/status; caller owns endpoint, eligibility predicate, and request relationship mapping. No client-side unbounded “recent files” fetch as the long-term pattern. |

Do **not** extract a generic polling hook yet. The archive sequence has output-file
state, retry semantics, and a 1-second implementation today, while translations
have status panels and different cadence. Extract a tiny `usePollWhile` only if
three callers share a tested terminal predicate/cancellation/backoff contract;
otherwise keep polling local and explicit. Likewise, retain local snackbars until
three operations truly share the same success/error/retry semantics.

## Concrete implementation sequence (after the gate)

1. Create the Core Library support matrix and add only confirmed manifest entries
   and developer-owned hooks. Ensure generator `--check` stays clean before and
   after every generated file update.
2. Migrate Phase 1 Files through the framework while retaining named raw handler
   exports (or equivalent direct test seams). Move route-imported browser request
   types into the generated resource contract/client module only as each route is
   migrated. Preserve the current FileTable URL/request order and `File` mapper.
3. Migrate Phase 1 Collections and archive jobs. Keep `fetchAllFileCollectionFiles`,
   `getFileCollectionExportAvailability`, and `buildFileArchiveJobRequest` as
   domain helpers. Confirm the collection SSR detail page's redirect/not-found
   behavior survives unchanged.
4. Migrate Parts, revisions, and translation inspection without broadening
   mutability. Upgrade the existing radio list to the shared relationship picker
   only once that component has its three intended consumers and server paging.
5. Implement Phase 2 verified fields/membership actions. Add user-facing context
   and error feedback before mutation, then targeted cache invalidation and a
   refresh after completion or partial failure.
6. Implement Phase 3 as read-only nested inspection. Do not add navigation/menu
   links for a resource the account/module may not expose; render normalized
   unsupported/permission errors in context.
7. Format, lint, test, run generator drift check, build, and hand the complete
   validation template to the independent validator. Address any failure in a
   new implementation loop, preserving its reproduction evidence.

## Tests required from the implementor

Extend—not replace—the existing MockServer raw-handler tests in
`src/__tests__/pages/api/` and the MSW/Testing Library tests in
`src/__tests__/components/`. Use the validation protocol in
`03-validation-plan.md` as the release gate.

| Area                       | Minimum additional evidence                                                                                                                                                                                                                                                                                                                                |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework migration parity | Existing Files/File Collections/File Jobs route contracts continue to verify exact upstream path, query/body, JSON:API headers for raw calls, method validation, and mapped errors. Invalid input has zero upstream interactions.                                                                                                                          |
| Files                      | Current filter/sort/default-page behavior remains; create success/upload failure leaves a retryable created-file state; unavailable status disables download/create-part/add-to-collection; URL action failures show useful errors without rendering the URL.                                                                                              |
| Destructive operations     | Dialog cancellation causes zero request; confirmed file/part/collection deletion uses selected IDs; server partial failure shows failed IDs/reselection and refreshes. Membership remove proves it does not call file delete.                                                                                                                              |
| Collections/membership     | Manage-files candidate search and cursor paging; add/remove request shape; member/file/detail/list cache invalidation; collection detail uses the new membership after mutation.                                                                                                                                                                           |
| Archive job                | Empty/incomplete collection blocks server creation; valid flow creates archive file then job with all IDs; non-terminal → complete and error states poll/stop correctly; retry restarts only an allowed workflow; generated download URL is never cached/displayed. Preserve current page tests.                                                           |
| Parts/revisions/inspection | Source picker accepts only eligible files; typed relationship body is exact; queued job feedback links to resource when reference data permits; lazy revision/rendition/instance detail handles loading/empty/error/404 parent context.                                                                                                                    |
| Translations/status        | Only running states poll; terminal/unknown states display accurately; status filter and resource-link resolver preserve a useful error fallback.                                                                                                                                                                                                           |
| Browser                    | Once the framework’s deterministic local Playwright harness exists, execute the controlled fixture flow: file create/upload retry → complete → part/queued translation → revision detail → collection membership → archive start/poll/download action → correct deletion/removal confirmation. Never use live shared credentials or destructive real data. |

Run `yarn format`, review its diff, then `yarn lint`, `yarn test:ci`,
`yarn api:generate:check`, and `yarn build`. If Testcontainers/Docker or the
e2e fixture environment is unavailable, report the check as not run and have the
independent validator rerun it in a capable environment; it is not a pass.

## Implementation handoff checklist

Before handing to the implementor, attach:

- The completed 0.44.0 SDK/reference support matrix and explicit deferred items.
- Accepted framework PR/commit and evidence that route/generator validation passed.
- Final manifest entries and each custom hook/action with its operation contract.
- Exact pages/components/routes touched and preserved response contracts.
- Any new shared abstraction with its three consumers and focused tests.
- The intended fixture data, mutation safety plan, and cache invalidation list.

Before handing to the validator, attach the completed validation template from
`03-validation-plan.md`, including commands/results, browser fixture evidence,
and any known limitations. A missing SDK decision, framework acceptance, or
deterministic browser path blocks this group rather than authorizing an
untyped/broad implementation.
