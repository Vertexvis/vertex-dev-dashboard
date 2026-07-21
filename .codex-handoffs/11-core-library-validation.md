# Validation — Core import and library completion

## Scope and baseline

- Worktree: `/private/tmp/vertex-dev-dashboard-vertex-api-exercise`
- Reviewed against accepted framework commit `1b7bb24`.
- Review scope: Core implementation handoff 08 and every product/test change since
  that commit. Concurrent scene planning/handoffs 09–10 were not assessed.
- Installed SDK evidence: `@vertexvis/api-client-node@0.44.0`,
  `node_modules/@vertexvis/api-client-node/dist/cjs/api.d.ts`.
  `FileCollectionsApi.addFileCollectionFiles` accepts `{ id, fileIdList }`,
  where `FileIdList` is `{ data: string[] }`; `removeFileCollectionFiles`
  accepts `{ id, filterFileId?: string }`. The implementation's intended SDK
  request shapes match those declarations. `PartsApi.createPart` and
  `deletePart` also exist with the declared object request forms.

## Commands and results

| Command                                                                                                                                              | Result                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `yarn api:generate:check`                                                                                                                            | Passed.                                                                                                                                                               |
| `yarn lint`                                                                                                                                          | Passed with no lint errors/warnings.                                                                                                                                  |
| `yarn test --selectProjects node --runInBand src/__tests__/pages/api/file-collection-files.test.ts src/__tests__/pages/api/parts-validation.test.ts` | Passed: 18 tests.                                                                                                                                                     |
| `yarn test --selectProjects browser --runInBand src/__tests__/components/file-collection/FileCollectionFilesTable.test.tsx`                          | Passed: 8 tests.                                                                                                                                                      |
| `yarn build`                                                                                                                                         | Passed.                                                                                                                                                               |
| `yarn test:e2e`                                                                                                                                      | Passed: 3 existing authenticated Files-fixture tests. First sandbox run could not bind `0.0.0.0:3100` (`EPERM`); the exact command passed with local-port permission. |
| `docker version --format '{{.Server.Version}}'`                                                                                                      | Passed with permitted Docker access: `29.5.3`.                                                                                                                        |
| `yarn test --selectProjects node --runInBand src/__tests__/pages/api/files.test.ts src/__tests__/pages/api/file-collections.test.ts`                 | Passed: 13 Testcontainers/MockServer tests. Expected upstream-error paths log `console.error`, but Jest passes.                                                       |
| `yarn test:ci`                                                                                                                                       | Passed: 19 suites, 117 tests. The same pre-existing React `act(...)` warning in `FileCollectionTable` is emitted but does not fail the gate.                          |
| `git diff --check 1b7bb24`                                                                                                                           | Passed.                                                                                                                                                               |

## Security/session and SDK assessment

- The new collection membership UI uses same-origin dashboard routes only. Its
  client path encodes the collection ID, and no Vertex token, secret, or
  upstream URL is placed in the DOM or request URL.
- The raw API handler remains wrapped by `withSession`; valid mutation input is
  parsed before `getClientFromSession`, so malformed membership bodies do not
  construct a Vertex client. This is covered by the focused Node test.
- `POST` is a typed collection-relationship operation and `DELETE` uses the
  collection relationship endpoint; neither calls `FilesApi.deleteFile`. The
  add/remove SDK parameter shapes agree with the installed 0.44.0 declarations.
- The source-file-preserving wording, disabled non-complete candidates, named
  removal confirmation, duplicate-ID normalization, and POST/DELETE error
  display are good starts, but they do not satisfy all required invalidation
  and failure paths below.

## Defects

### 1. High — empty or whitespace collection IDs reach Vertex instead of returning 400

`getFileCollectionId` in `src/pages/api/file-collections/[id]/files.ts:128-130`
returns `head(req.query.id)` without trimming or rejecting an empty string.
Consequently, each GET/POST/DELETE guard at lines 53-56, 77-80, and 107-109
accepts `id: ""` or `id: "   "`, constructs a session client, and supplies that
invalid identifier to the Vertex SDK. This contradicts handoff 08's claim that
empty/blank parent IDs are rejected before client construction and the
validation-plan requirement for malformed nested IDs.

Reproduction: invoke `handleFileCollectionFiles` with `method: "POST"`,
`query: { id: " " }`, and `body: JSON.stringify({ fileIds: ["file-1"] })`.
The code takes the `addFileCollectionFiles` path rather than returning the fixed
400 response; the same applies to DELETE and GET.

Required rework:

- Normalize the dynamic ID once (`trim`) and return `undefined` for empty/blank
  values before any client/session work. Preserve normal opaque IDs exactly
  after this non-empty validation.
- Add direct raw-handler regression cases for missing, `""`, whitespace, and
  array/ambiguous parent IDs for GET/POST/DELETE. Assert 400 and no
  `getClientFromSession`/SDK call.

### 2. High — Part mutations still report success when Vertex rejects them

The new Parts validation seam verifies malformed bodies, but it does not harden
the mutation error path. In `src/pages/api/parts.ts:85-93`, `makeCall` converts
each upstream delete error into `Failure`; the route ignores all results and
returns `{ status: 200 }`, including a partial or total failure. In
`src/components/part/PartTable.tsx:133-140`, the client clears selection before
the request, does not inspect `res.ok`, and refreshes as though deletion worked.
`create` at `src/pages/api/parts.ts:96-123` also lets an SDK/network rejection
escape rather than mapping it to the established `ErrorRes` envelope.

This violates the validation plan's mutation requirement that conflict/error and
partial failure be surfaced accurately, and it makes the claimed Phase-1 Parts
hardening incomplete. It is observable with an upstream 404/500: the dashboard
returns 200 for DELETE and gives the user no error/retry state.

Required rework:

- Normalize `createPart` errors and every `deletePart` result through the
  existing error conversion. For a bulk delete, return an explicit non-2xx
  aggregate/per-ID failure contract rather than 200; do not discard `Failure`.
- Do not clear selected parts until success. Add error feedback, preserve or
  reselect failed IDs, guard repeat submission, and add user confirmation if
  the existing destructive-action convention requires it.
- Add raw-handler tests for Part create 4xx/5xx/network failure and delete
  total/partial upstream failure, plus a component test proving errors remain
  visible and selection is retained.

### 3. Medium — successful membership mutations do not invalidate readiness or an open file-detail relationship view

After add/remove, the detail page only increments `membershipVersion` at
`src/pages/file-collections/[fileCollectionId].tsx:672-680`, remounting the
member table. It never calls `loadReadiness`, whose only automatic effect is
keyed by collection ID/path at lines 414-420. For example, start with an empty
collection (archive disabled), add a complete file, and the archive controls
remain disabled until the user discovers and presses **Refresh Availability**.
The inverse stale state after removal is also possible (though the server
correctly rechecks readiness when an archive is created).

The currently open `FileDetailsDrawer` similarly refreshes reverse collection
membership only when `[fileId, open]` changes
(`src/components/file/FileDetailsDrawer.tsx:112-175`), so it remains stale after
adding/removing the selected file. This misses the engineering-plan requirement
to invalidate collection members, archive readiness, and file-detail/eligible
queries after membership mutation.

Required rework:

- Centralize a post-membership-success callback that revalidates member data
  **and** export availability; use it for both add and remove. Ensure an open
  drawer's reverse membership view is refreshed (a version/revalidation prop is
  sufficient), and clear/revalidate candidate-file data as appropriate.
- Add component integration coverage for both add and remove showing the next
  readiness response changes the archive control and a selected file's reverse
  collection list refreshes.

## Browser and contract coverage gaps

- The committed Playwright suite is real and passes, but it covers only the
  existing `/files` local fixture and error state. It has no collection-detail
  spec and no fixture/local-upstream strategy for that page's authenticated SSR
  `getFileCollection` call. It therefore cannot reproduce keyboard selection,
  add success/error, confirmation, or removal for this increment. Do not claim
  browser coverage for membership until a local SSR-safe stub/session flow and
  a collection-detail spec are added.
- Docker is available in this validation environment and existing Files and
  File Collections MockServer suites passed. There is nevertheless no
  Testcontainers/MockServer contract test for the **new nested**
  `POST/DELETE /api/file-collections/:id/files` route. The focused nested test
  mocks the SDK and cannot prove the SDK's actual serialized relationship body
  or comma-separated delete filter. Add exact upstream POST/DELETE request,
  4xx/5xx, and no-upstream-on-validation-failure cases.

## Scope/deferred-endpoint assessment

The implementation appropriately does not introduce a generic proxy or guessed
SDK endpoints. The explicit deferral of rendition/revision/geometry/translation
mutations is sensible for 0.44.0. No additional manifest entry was needed for
the custom existing envelopes. The Core increment is not acceptable yet because
the defects above affect delivered membership/Parts workflows, not deferred
API breadth.

## Disposition

**Rejected — return to implementor.** Resolve defects 1–3, add the nested
MockServer contract suite and reproducible collection-membership Playwright
flow, then rerun generator check, lint, focused route/component suites,
`yarn test:ci`, `yarn test:e2e`, and `yarn build`. The next validator must
retest the blank-ID, upstream Part failure, readiness/drawer invalidation, and
membership browser/contract cases specifically.

---

## Final revalidation — 2026-07-21

### Repair assessment

All three prior implementation blockers are resolved.

1. **Nested parent validation — resolved.**
   `getFileCollectionId` now accepts only a scalar string, trims it, and returns
   `undefined` for an empty result. The raw route returns 400 before client
   construction. The new Docker-backed membership contract test covers a blank
   parent ID and asserts zero upstream interactions.
2. **Parts mutation errors — resolved.**
   Part create/delete now map the `makeCall` failure result to the existing
   `ErrorRes` contract. A bulk delete returns the first failure rather than a
   false 200. The Part table retains selection until a successful response and
   shows mutation errors. Focused tests cover create failure, total delete
   failure, and partial delete failure.
3. **Membership invalidation — resolved.**
   A shared successful-membership callback bumps the member version, reloads
   export readiness, revalidates File/File Collection SWR keys, and passes the
   membership version to an open file-details drawer. Focused detail/drawer
   tests cover the refresh behavior.

### Confirmation and destructive-action regression

- **Parts:** intentionally remains confirmation-free. The Part-table test spies
  on `window.confirm` (returning false), proves it is never called, and verifies
  the existing `DELETE /api/parts` body is still `{ ids: ["part-1"] }`.
- **Files:** uses the shared native confirmation before the pre-existing delete
  request. Component tests prove cancellation makes no request and confirmation
  sends the original `/api/files` `{ ids: ["file-1"] }` request.
- **File collections:** likewise confirm before the existing collection delete.
  Tests prove cancellation makes no request and confirmation sends the original
  `/api/file-collections` `{ ids: ["collection-1"] }` request.
- **Collection membership:** retains its explicit source-file-preserving
  confirmation wording. Cancellation makes no nested DELETE request; a
  confirmed removal sends the membership-only `{ fileIds: [...] }` body.

### Revalidation evidence

| Command                                                                                     | Result                                                                                                                        |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `yarn api:generate:check`                                                                   | Passed.                                                                                                                       |
| `yarn lint`                                                                                 | Passed.                                                                                                                       |
| Docker-enabled focused Node suite (membership MockServer, Parts, nested route)              | Passed: 82 tests. The explicit 409/5xx fixtures log expected SDK errors.                                                      |
| Focused browser/component suite (Parts, Files, File Collections, membership, drawer/detail) | Passed: 61 tests. The pre-existing `FileCollectionTable` test emits one non-fatal React `act(...)` warning.                   |
| `yarn test:e2e`                                                                             | Passed: 4 tests. The new authenticated, SSR-safe local fixture opens collection detail and completes the add-membership flow. |
| `yarn build`                                                                                | Passed.                                                                                                                       |
| `yarn test:ci`                                                                              | Passed: 22 suites, 143 tests, with Docker/Testcontainers available.                                                           |
| `git diff --check 1b7bb24`                                                                  | Passed.                                                                                                                       |

### Browser/contract verdict

The local E2E upstream fixture is restricted to non-production
`E2E_TEST_MODE=true` and the fixture bearer token; the authenticated session
bootstrap remains protected by the ephemeral runner secret. The new Playwright
spec exercises the previously untestable SSR collection-detail route and its
add-membership interaction. The new Testcontainers suite proves the exact SDK
serialization for relationship add (`POST` body `{ data: [...] }`) and removal
(`filter[fileId]` query), as well as a typed 409 response and invalid-parent
zero-interaction behavior.

### Final disposition

**Accepted.** The prior Core blockers and stated confirmation requirements are
resolved, the full quality matrix passes, and no new Core-scope defect was
found in this independent revalidation.
