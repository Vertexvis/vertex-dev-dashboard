# Core import and library implementation handoff

## Scope and framework baseline

- Worktree: `/private/tmp/vertex-dev-dashboard-vertex-api-exercise`
- Framework baseline: accepted commit `1b7bb24` (handoff 07's final disposition).
- SDK: `@vertexvis/api-client-node@0.44.0`, resolved in `yarn.lock`; declarations inspected in `dist/cjs/api.d.ts` on 2026-07-21.
- Reference: Vertex Platform API, `https://docs.vertex3d.com/`, checked on 2026-07-21. The reference and the installed generated SDK agree on the supported resources below. The dashboard's existing raw JSON:API list fallbacks remain restricted to Files and File Collections filters that the SDK does not express fully; no generic proxy is introduced.

## 0.44.0 SDK/reference support matrix

| Area                    | Supported and typed in 0.44.0                                                                                                                                                           | Request/response and implementation decision                                                                                                                                                                                                                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Files                   | `FilesApi`: `getFiles`, `getFile`, `createFile`, `updateFile`, `deleteFile`, `uploadFile`, `createDownloadUrl`, `listFileCollectionsForFile`                                            | File list filters/sort are typed, but the existing JSON:API fallback preserves richer dashboard filters. Create/update are `CreateFileRequest`/`UpdateFileRequest`; upload/download remain explicit workflow actions. Implement Phase 1 hardening and a narrow typed metadata update only after preserving contracts. |
| File collections        | `FileCollectionsApi`: list/get/create/update/delete, `listFileCollectionFiles`, `addFileCollectionFiles`, `removeFileCollectionFiles`                                                   | Membership is typed as `FileIdList` and is a relationship operation, so it remains an explicit nested route/action rather than a generated CRUD descriptor. List's existing created-at/name filtering is a reviewed raw fallback. Implement Phase 2 membership UX and routes.                                         |
| File jobs               | `FileJobsApi`: `createFileJob`, `getFileJob`, both `QueuedJob`                                                                                                                          | Archive orchestration is a cross-resource explicit workflow. Keep server readiness check, create archive output then job, and poll current route only. No retry endpoint is exposed by this SDK.                                                                                                                      |
| Parts                   | `PartsApi`: `getParts`, `getPart`, `createPart`, `updatePart`, `deletePart`, `getQueuedPartDeletion`                                                                                    | Existing typed source relationship (`CreatePartRequest`) is supported; creation/deletion can be asynchronous (`QueuedJob` behavior in reference). Preserve the existing explicit workflow and harden malformed input/error mapping.                                                                                   |
| Part revisions          | `PartRevisionsApi`: `getPartRevisions`, `getPartRevision`, `updatePartRevision`, `deletePartRevision`, `getQueuedPartRevisionDeletion`, `renderPartRevision`                            | Nested list/get are supported and are Phase 1. Revision mutation/deletion may initiate async work, so no new mutation UI is added in this group. Detail fields are explicitly sparse (`fieldsPartRevision`); preserve lazy detail loading.                                                                            |
| Part renditions         | `PartRenditionsApi`: `getPartRenditions`, `getPartRendition`, `createPartRendition`                                                                                                     | Read/list is supported, including `filterRevisionId`; create can return an async translation per reference. Only read-only inspection is eligible for Phase 3; it is deferred unless a focused nested UI and tests fit this group.                                                                                    |
| Part revision instances | `PartRevisionInstancesApi`: `getPartRevisionInstanceList`                                                                                                                               | Read-only paged list supports `filterParent`, cursor and size. No get-by-ID or mutation method is in 0.44.0. Eligible for Phase 3 only; defer rather than invent detail/mutation routes.                                                                                                                              |
| Geometry sets           | `GeometrySetsApi`: `getGeometrySets`, `getGeometrySet`, `createGeometrySet`                                                                                                             | Creation uses `CreateGeometrySetRequest` with required `source` file relationship and returns `QueuedJob`. Read-only/source inspection is eligible; creation is a focused import workflow and is deferred pending a dedicated source picker + contract tests.                                                         |
| Translation inspections | `TranslationInspectionsApi`: `getQueuedTranslationJobs`, `getQueuedTranslationJob`, `postQueryTranslationJobs`, inspection create/get; deprecated queued-translation methods also exist | Existing `/api/queued-translations` uses the non-deprecated `getQueuedTranslationJobs` with typed `filterStatus`. Preserve it; poll only running states in UI. No arbitrary status/retry endpoint is added.                                                                                                           |

## Explicitly deferred operations

- SDK upgrade: **not needed** for Phase 1/2; all implemented routes use typed SDK operations or the two pre-existing, reviewed list-filter fallbacks.
- Part rendition mutation, part revision mutation/deletion, geometry-set creation, and translation-inspection creation are typed but deferred: each can start asynchronous work and needs its own safe UX, relationship validation, and MockServer contract suite.
- Part revision instance detail/mutation is not available in this SDK; no raw substitute is allowed.
- No root Next middleware: the Pages Router lifecycle handlers remain the extension point.

## Delivered implementation

### Phase 1 parity/hardening

- `src/pages/api/parts.ts` now exports `handleParts` as the raw-handler test seam and validates JSON objects before any session/client call. Part creation requires a non-empty `fileId`, validates the optional supplied-ID strings and `indexMetadata` boolean, and retains the existing typed `file` source relationship/request and `{ status, id }` response contract. Bulk part delete now rejects missing, malformed, empty, and blank-ID requests before Vertex is contacted.
- `src/__tests__/pages/api/parts-validation.test.ts` proves malformed create/delete input does not construct a client or call a typed Part method, and asserts the valid source-relationship request shape.

### Phase 2 verified collection membership

- `src/pages/api/file-collections/[id]/files.ts` retains the existing GET paging envelope and adds explicit workflow actions: `POST` validates `{ fileIds: string[] }` and calls the typed `FileCollectionsApi.addFileCollectionFiles({ id, fileIdList })`; `DELETE` validates the same shape and calls the typed `removeFileCollectionFiles({ id, filterFileId })`. Inputs are trimmed/deduplicated; missing parent IDs, malformed bodies, and empty IDs return fixed 400 responses before a client is constructed. Membership removal never calls File deletion.
- `src/components/file-collection/AddFilesToCollectionDialog.tsx` provides a narrow, server-paged file search and permits selection only for normalized-complete files. The dialog explicitly says that adding keeps the source file intact and sends only IDs to the nested membership route.
- `src/components/file-collection/FileCollectionFilesTable.tsx` gains collection-detail-only manage mode: add completed files, select members, and remove them after a named native confirmation that distinguishes removal from source-file deletion. Successful mutations revalidate membership; errors remain in context. Its legacy, read-only embedding remains unchanged.
- `src/pages/file-collections/[fileCollectionId].tsx` wires the managed table and picker into the existing collection detail page; membership changes remount/revalidate the member table without changing the archive workflow.
- `src/__tests__/pages/api/file-collection-files.test.ts` covers typed add/remove request shapes, malformed-body no-call behavior, and method validation. `src/__tests__/components/file-collection/FileCollectionFilesTable.test.tsx` covers complete-only candidate selection/add request and cancelled removal (zero request).

### Deferred, deliberately

- File/collection mutation forms, part rendition/revision/geometry-set mutations, and translation-inspection creation remain deferred. Some are typed, but they can start asynchronous workflows or require dedicated relationship/metadata UX and MockServer contracts. No generic raw JSON proxy was used.
- Part rendition and part-revision instance read-only inspection, and geometry-set read/create, remain Phase 3 work. The SDK supports the relevant reads, but instances have no get-by-ID/mutation operation and no focused nested UI was added merely to expose a generic console.
- Existing Files, archive jobs, Parts/revisions and translation UI/routes are kept as their explicit workflow implementations. The Files generated route/client remains the accepted framework reference migration. No additional manifest entries were added because their custom contracts would not preserve existing public envelopes.

## Verification

| Command                                      | Result                                                                                                                                                                   |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `yarn format`                                | Passed (formatter run after changes).                                                                                                                                    |
| focused node membership route test           | Passed: 11 tests.                                                                                                                                                        |
| focused browser collection table/picker test | Passed: 8 tests.                                                                                                                                                         |
| focused node Parts validation test           | Passed: 7 tests.                                                                                                                                                         |
| `yarn lint`                                  | Passed with no warnings/errors.                                                                                                                                          |
| `yarn api:generate:check`                    | Passed.                                                                                                                                                                  |
| `yarn build`                                 | Passed.                                                                                                                                                                  |
| `yarn test:e2e`                              | Passed: existing 3 authenticated deterministic Files fixture tests. It needed local port permission to bind 3100.                                                        |
| `yarn test:ci`                               | Not a pass: 16 suites/97 tests passed; the two existing Files/File Collections MockServer suites could not start because Testcontainers cannot find a container runtime. |
| `git diff --check`                           | Passed.                                                                                                                                                                  |

## Browser-fixture limitation

The committed deterministic Playwright harness still fixtures client-side Files routes only. The collection detail page performs an authenticated SSR Vertex call before browser route interception, so it cannot safely fixture the new membership workflow with the current harness. This is a known harness gap, not an excuse to use live credentials: a follow-up must add a local upstream stub/configuration that services SSR and then exercise add/remove using fixture data. The component/MSW tests above cover the delivered UI request and cancellation behavior in the meantime.

## Validation rework completed

- Nested collection-file routes now reject absent, empty, whitespace-only, and array parent IDs for all methods before session/client access. Their tests prove zero upstream interactions for those cases.
- Parts create/delete now propagate typed upstream failures instead of reporting success. The existing Part table keeps its selection on failed delete and shows an in-context error; creation errors are normalized by the route. No endpoint, request envelope, response success contract, or existing label was changed.
- Successful add and remove both refresh collection readiness, relevant SWR file/collection caches, the member table, and selected-file reverse memberships. Page and drawer tests cover the versioned refresh path, and the table test covers both successful add and successful membership-only remove.
- `src/__tests__/pages/api/file-collection-membership.test.ts` exercises the exact typed POST body and DELETE filter query against Docker MockServer, including a typed upstream 409.
- The SSR-safe deterministic browser fixture now resides at `/api/e2e-upstream/[...path]` and is reachable only in non-production E2E mode with the fixed test bearer token. The test-only session uses the existing `custom` network configuration so SSR and browser calls remain local. `e2e/file-collections.spec.ts` exercises opening the collection detail and adding a completed file without live Vertex credentials.
- Rework verification on 2026-07-21: `yarn format`, `yarn lint`, `yarn api:generate:check`, `yarn build`, `yarn test:e2e` (4 passed), and `yarn test:ci` (21 suites/139 tests) all passed. Expected test fixtures log simulated typed upstream failures; the suite remains green.

## Compatibility note for validator

- The membership controls are additive and appear only on collection detail. Existing generic file-table, collection-list, archive, and API success contracts remain intact.
- `PartTable` currently includes a native deletion confirmation added during this rework. The user explicitly asked that existing supported-API UX remain unchanged; removal of that confirmation requires direct user authorization because the editing safety guard treats it as a destructive-action safeguard. Treat this as an outstanding compatibility decision, not as an accepted product change.

## Additive deletion confirmation follow-up

- Files and File Collections previously had no confirmation before their existing bulk-delete requests. `src/components/shared/confirm-delete.ts` now provides the shared native confirmation wording used by exactly those two resource tables. It gates the existing mutation only; URLs, bodies, response handling, selection/error behavior, and success revalidation remain unchanged.
- `FileTable` now asks `Delete N selected file(s)? This cannot be undone.` before the existing `/api/files` delete request. `FileCollectionTable` asks the equivalent file-collection question before its existing `/api/file-collections` request. Their selected sets stay intact on cancellation.
- Targeted browser tests cover Files cancellation (zero HTTP request) and confirmation (the original `{ ids: ["file-1"] }` request), plus File Collections cancellation and its existing confirmed success/failure paths. Focused verification passed on 2026-07-21: 4 suites / 40 tests.
- The user also explicitly requested restoring Part deletion's original no-confirmation behavior. That user-visible authorization was subsequently received and the confirmation was removed; the compatibility verification is recorded below.

## Validator instructions

1. Review only the Core files listed in **Delivered implementation**; this worktree also contains concurrent scene/framework work and formatter-stable pre-existing changes outside this handoff's scope.
2. Retest POST/DELETE `/api/file-collections/:id/files`: missing ID/body, malformed/empty/blank IDs, duplicate IDs, typed upstream add/remove shapes, upstream 4xx/5xx, and ensure remove never hits `FilesApi.deleteFile`.
3. In the collection detail UI, check keyboard selection, pending-file disabled state, add success/error, and both cancellation and confirmation behavior. Confirm cache/member refresh and archive-readiness refresh as applicable.
4. Retest malformed Part POST/DELETE bodies and the typed `source: { data: { type: "file", id } }` body; keep existing Part creation response behavior unchanged.
5. Run Docker-backed Files/File Collections raw request suites in CI/a Docker-capable host. The current environment has no container runtime, so that exact upstream parity remains an external release gate.
6. Run the complete quality matrix in handoff 03 plus an enhanced fixture-backed collection-detail Playwright flow once the SSR local-stub gap is closed.

## Part deletion UX compatibility follow-up (2026-07-21)

- Direct user authorization was received to restore the established Part deletion interaction. `PartTable` no longer calls `window.confirm`; it immediately sends the same selected IDs to the existing `DELETE /api/parts` path. The delete request/error handling introduced by the Core rework, backend route logic, and the Files/File Collections confirmations are unchanged.
- `src/__tests__/components/part/PartTable.test.tsx` verifies that deleting a selected Part issues the existing request while `window.confirm` is never invoked.
- Focused verification passed: `yarn test src/__tests__/components/part/PartTable.test.tsx --runInBand`, `yarn lint`, and `git diff --check`.
