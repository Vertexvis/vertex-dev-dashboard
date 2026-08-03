# Validation — Exports and Documents

## Scope and evidence reviewed

- Worktree: `/private/tmp/vertex-dev-dashboard-vertex-api-exercise`
- Reviewed the framework and accepted Core/Scene handoffs (05, 07, 08, 11,
  14), the Exports/Documents research, engineering plan, and implementation
  handoffs (12, 13, 15), all Exports/Documents source, their one route test,
  and the controlled browser harness.
- Rechecked the installed `@vertexvis/api-client-node@0.44.0` declarations.
  `ExportsApi.getQueuedExport` is typed as `QueuedJob`, while the official API
  says it redirects to an export when complete. The installed `getPage` helper
  retrieves exactly one page; it does not iterate cursors.
- Rechecked the current official API reference on 2026-07-21. It confirms the
  Documents endpoints and their Preview status, and that queued exports
  redirect on completion. It specifies `config.format` only as `string`; it
  does not establish `step` as an accepted token or establish this UI's
  60..86400 expiry limits. Source: https://docs.vertex3d.com/

## Commands and results

| Command                                                                                 | Result                                                                                                                                                                                      |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `yarn api:generate:check`                                                               | Passed.                                                                                                                                                                                     |
| `yarn lint`                                                                             | Exit 0, but four new import-order warnings: `artifacts.test.ts`, `DocumentsPage.tsx`, `SceneExports.tsx`, and `documents.hooks.ts`.                                                         |
| `yarn test --selectProjects node --runInBand src/__tests__/pages/api/artifacts.test.ts` | Passed: 5 tests. This is unit/mock coverage only.                                                                                                                                           |
| `docker info --format '{{.ServerVersion}}'`                                             | Passed: Docker 29.5.3 available.                                                                                                                                                            |
| `yarn test:ci --runInBand`                                                              | Passed: 25 suites / 154 tests. Existing Docker MockServer contracts ran, but no Export/Queued Export/Documents MockServer contract was present, so this is not an artifacts transport pass. |
| `yarn test:e2e`                                                                         | Passed with local-port permission: setup plus existing Files, File Collections, and Scene Workspace specs. There is no Exports/Documents spec.                                              |
| `yarn build`                                                                            | Passed, with the same four import-order warnings.                                                                                                                                           |
| `git diff --check`                                                                      | Passed.                                                                                                                                                                                     |

## Preserved existing UX

- The increment is additive in its visible routing: a Scene Workspace Exports
  tab and Documents (Preview) drawer/page. The existing File Collection
  Playwright flow passed, and the implementation does not replace existing
  Scene Viewer or File paths.
- This is not sufficient for acceptance because the new workflow has no
  artifact-specific browser coverage and the existing-UX review cannot prove
  the required API behavior below.

## Defects / required rework

### 1. Blocker — queued-export completion follows an unvalidated upstream redirect

- **Location:** `src/pages/api/queued-exports/[id].ts:31-34`.
- **Reproduction:** Arrange `GET /queued-exports/<id>` to respond with a 3xx
  `Location` pointing at an off-host or malformed URL. The route calls the
  default Axios-backed SDK method without disabling redirect following or
  validating the location. Axios can make the server-side follow request
  before the implementation sees a terminal body. The only test supplies an
  already-deserialized running job, so it never exercises a 3xx.
- **Impact:** Violates the agreed redirect boundary: an upstream Location must
  be constrained to the configured Platform host and `/exports/<opaque-id>`
  before resolution. It is both an SSRF/credential-boundary risk and leaves
  completion semantics unproven.
- **Fix:** Use a no-redirect SDK/Axios request (or a safe raw response path),
  validate scheme/host/path/opaque ID, then retrieve the export through the
  typed client. Add Docker MockServer cases for relative/valid completion,
  off-host/malformed/missing Location rejection, and the actual installed
  Axios behavior. The browser must receive only the normalized safe terminal
  envelope.

### 2. Blocker — `step` is an unverified production export contract

- **Location:** `src/lib/artifacts.ts:10`, `SceneExports.tsx:70`.
- **Reproduction:** The current official API reference and SDK both define
  `config.format` as an unconstrained string. Neither names `step`, required
  format-specific options, nor the UI's selected expiry bounds. Handoff 15
  explicitly records this as an outstanding validation gate.
- **Impact:** The only UI action may produce a request the Platform rejects;
  it cannot be accepted as a typed, useful API exercise.
- **Fix:** Obtain an authoritative current Vertex/Postman example or test with
  a disposable Platform account. Record exact token case, config/options, and
  server limits in the support matrix and add an exact MockServer contract.
  Otherwise gate/remove Export start rather than presenting an unverifiable
  action.

### 3. High — scene-view-state ownership check rejects valid state IDs beyond the first page

- **Location:** `src/pages/api/exports.ts:40-53`.
- **Reproduction:** Create a scene with more than 100 saved states and choose
  a state on page 2. `getPage` makes one request, then `.page.data.some(...)`
  returns false and the route responds `400 Scene view state does not belong
to this scene.`
- **Impact:** A valid export cannot include later states. This was an explicit
  adversarial gate in handoff 15.
- **Fix:** Use the SDK's scene-view-state `filterId` for the supplied state ID
  (while preserving the scene path) or paginate with a strict bound. Add a
  no-client/invalid, first-page, later-page/filter, and wrong-scene contract
  test.

### 4. High — required artifacts contract and UI/browser coverage is missing despite Docker being available

- **Evidence:** `src/__tests__/pages/api/artifacts.test.ts` has five mocked
  handler tests. There are no Exports/Documents test files under `e2e/`, no
  artifact component test, and no MockServer contract test. Docker is
  available and `test:ci` ran, so this is a missing implementation/validation
  asset, not an environment blocker.
- **Missing cases:** exact JSON:API request/media headers; Export 4xx/5xx;
  queued running/error/3xx completion; malformed/off-host Location; safe
  terminal redaction; click-time missing/expired URL; Documents 403/404/5xx;
  Document detail route; completed-file eligibility; cursor/filter request;
  export double-submit, polling cancellation/manual refresh, and no-URL DOM/
  storage/history behavior.
- **Fix:** Add deterministic local MockServer and Playwright fixtures for the
  complete Export and Documents workflows, including the redaction assertion,
  and run them in `test:ci` / `test:e2e`.

### 5. Medium — Documents Preview page does not implement its promised read-only capability state or detail/pagination workflow

- **Location:** `src/components/artifacts/DocumentsPage.tsx:84-194`.
- **Reproduction:** Return `{ status: 403, message: "Forbidden" }` from
  `/api/documents` while Files succeeds. The list displays an error, but the
  registration form remains enabled; it does not transition to the planned
  Preview-unavailable read-only state. The UI also exposes neither the typed
  `GET /api/documents/:id` detail route nor cursor navigation, though it says
  it can inspect documents and handoff 13 requires lazy detail and paging.
- **Impact:** Preview unavailability is misleading and the delivered page does
  not expose all promised safe operations.
- **Fix:** Use the response status (not a string search for `"403"`) to show
  the capability/read-only notice and disable registration only for that
  capability. Add a lazy detail drawer and cursor controls, with component and
  e2e coverage. Keep update/delete/upload/download absent.

### 6. Medium — export polling lacks cancellation/revision protection and bounded backoff

- **Location:** `src/components/artifacts/SceneExports.tsx:31-53`.
- **Reproduction:** Start a refresh, then navigate/unmount or change the
  workspace before it resolves. `refresh` has no `AbortController` or
  workspace revision check and can update its stale component. Each successful
  response restarts a fixed two-second timer indefinitely.
- **Impact:** Does not meet the planned cancellation/stale-workspace and
  bounded-backoff requirements for an asynchronous operation.
- **Fix:** Abort in-flight polling on cleanup, bind results to a workspace/job
  revision, add bounded backoff and retry/error tests.

### 7. Low — quality warning debt

- **Location:** imports in the four files listed in the command evidence.
- **Impact:** `yarn lint` exits successfully but reports new formatter/lint
  warnings, contrary to the project instruction to fix reported issues.
- **Fix:** Run the formatter or apply the import-order fixes and confirm a
  warning-free lint/build.

## Security assessment

- Good: normal export detail redacts `downloadUrl`; the click endpoint sends
  `Cache-Control: no-store`; the component does not store or render the URL.
  The focused unit test covers that happy path.
- Not accepted: the redirect behavior has not been made safe/proven, and the
  required browser assertion that the fixture URL is absent from DOM, history,
  local storage, and session storage is missing.

## Intentionally absent / correct scope

- No `GET /api/exports` list route.
- No Documents upload, update, delete, download, or claimed export linkage.

## Final disposition

**Rejected — return to implementation/research.** Resolve defects 1-6,
obtain authoritative `step` support evidence (or gate export creation), then
run the new Docker contracts, component suites, artifact Playwright smoke
flows, `yarn api:generate:check`, warning-free `yarn lint`, `yarn test:ci`,
`yarn test:e2e`, and `yarn build`. The next validation pass must retest the
3xx redirect and off-host rejection, state ownership beyond the first page,
Preview 403 read-only behavior, and URL-redaction browser assertions.

---

## Revalidation — 2026-07-21

### Original findings rechecked

| Prior finding                       | Revalidation result                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unvalidated queued 3xx redirect     | **Resolved.** The handler requests `maxRedirects: 0`, accepts only 200/3xx, validates a same-origin no-query/no-hash `/exports/<opaque-id>` location, and performs a typed server-side export lookup. An independent Docker MockServer SDK check returned `{status:302, location:"/exports/export-1", followedExport:false}` and verified zero requests to `/exports/export-1`; the focused handler suite also checks same-host resolution and off-host rejection. |
| Unverified `step` request           | **Resolved by safe feature gate, not by claiming support.** `POST /api/exports` now returns an explanatory 503 before client creation. The Scene Workspace tab contains no create/download/poll controls and states that no request is generated. The focused test covers both arbitrary and `step` input with no client/export call. This is useful developer feedback and cannot emit a guessed export request.                                                  |
| First-page state ownership          | **Not applicable while export creation is gated.** No request path can consume `sceneViewStateId`; the old parser/profile remains unused. When an approved export profile re-enables creation, it must use `filterId` or bounded pagination and add the prior adversarial test.                                                                                                                                                                                    |
| Documents Preview 403/detail/paging | **Partially resolved.** A 403 list response now shows capability copy and disables registration; a right-side lazy detail drawer and next/first cursor controls are implemented. The component test verifies only the 403 case.                                                                                                                                                                                                                                    |
| Export polling cancellation/backoff | **Not applicable while no export may be started or polled from the UI.** This requirement returns with any future enabled export profile.                                                                                                                                                                                                                                                                                                                          |
| Import-order warnings               | **Resolved.** `yarn lint` reports no warnings/errors.                                                                                                                                                                                                                                                                                                                                                                                                              |

### Revalidation commands and results

| Command                                               | Result                                                                                                                                                                                                    |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Independent Docker MockServer SDK 302/no-follow check | Passed. The pinned SDK returned the raw 302 and did not request the redirect target when given the route's options. This was an ad-hoc validator check; it is not yet a checked-in handler contract test. |
| `yarn api:generate:check`                             | Passed.                                                                                                                                                                                                   |
| `yarn lint`                                           | Passed; no warnings/errors.                                                                                                                                                                               |
| Focused artifact route suite                          | Passed: 6 tests.                                                                                                                                                                                          |
| Focused Documents Preview component suite             | Passed: 1 test (403/read-only).                                                                                                                                                                           |
| `yarn test:ci --runInBand`                            | Passed: 26 suites / 156 tests, including existing Docker-backed contracts.                                                                                                                                |
| `yarn test:e2e`                                       | Passed: existing five-test local fixture suite. It has no Exports/Documents spec.                                                                                                                         |
| `yarn build`                                          | Passed.                                                                                                                                                                                                   |
| `git diff --check`                                    | Passed.                                                                                                                                                                                                   |

### Remaining defects / gates

1. **High — required Documents browser/contract coverage is still absent.**
   Docker is available, but there is no checked-in MockServer contract for
   Documents serialization/error/detail, and the Playwright suite has no
   Documents page spec. The only new UI test verifies the 403 state. The
   agreed group plan requires the completed-file registration, filter/paging,
   lazy detail, and Preview-unavailable flows in the controlled browser.
   The safe Export feature gate makes export-start browser coverage inapplicable
   for this increment, but does not exempt Documents.

2. **Medium — applying a supplied-ID filter fails to reset pagination.**
   In `src/components/artifacts/DocumentsPage.tsx`, the Apply button invokes
   `setFilter(suppliedId.trim())` without clearing `cursor`. Reproduction:
   obtain a next cursor, select **Next page**, enter a filter, then select
   **Apply**. The request combines the old cursor with the new filter and can
   omit its first matching page. This violates the shared filter/pagination
   contract. Set the cursor to `undefined` atomically with the filter and add
   component/browser coverage.

3. **Medium — newly exposed Documents detail/pagination behavior is untested.**
   The new component test does not cover a list row opening `GET
/api/documents/:id`, error handling in that drawer, next/first cursor
   request construction, completed-file create/list invalidation, or filter
   application. These are not covered by the existing global suite.

### Security revalidation

- Normal export detail still redacts `downloadUrl`; click-time download still
  uses `Cache-Control: no-store`. The UI feature gate holds no URL state and
  has no browser action that can call the download endpoint.
- The queued redirect is now verified against a real local 302 at the pinned
  SDK level. A checked-in route-level Docker test should preserve that result.

## Revalidation disposition

**Rejected — narrow Documents rework required.** The export feature gate is
accepted as safe and useful pending authoritative export-profile evidence, but
the Exports/Documents group cannot be accepted until Documents receives its
required deterministic MockServer and Playwright coverage and fixes the
filter/pagination reset. Revalidate those flows, then rerun the full gates.

---

## Final Documents revalidation — 2026-07-21

### Narrow failure recheck

| Requirement                     | Independent result                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Filter changes reset pagination | **Passed.** Apply now clears `cursor` before updating the supplied-ID filter. The focused browser/JSDOM test and the Playwright flow both capture a filtered request with no cursor after navigating to page two.                                                                                                                                                                                                 |
| Typed Documents route contracts | **Passed.** The checked-in Docker MockServer suite covers the exact list cursor/size/filter serialization, completed-file-gated JSON:API create, generated detail route, and Preview 403/detail-404 mapping. The complete CI suite executed this contract successfully.                                                                                                                                           |
| Parser and error-hook hardening | **Passed by source review and contract execution.** Omitted `pageSize` now parses to 25 instead of being rejected; malformed scalar/body parsing remains before client acquisition; `onError` only calls `isFailure` for an actual response, while the generic route error mapper preserves Axios 403/404 failures. The Docker failure cases returned their local error envelopes rather than a success response. |
| Deterministic browser workflow  | **Passed.** New local-only Documents Playwright specs cover list, next page, filter-after-pagination, lazy detail, successful registration request shape, and Preview 403 read-only state. They intercept only local `/api` requests and use the fail-closed local test session.                                                                                                                                  |
| Existing UX/regression          | **Passed.** The full Playwright suite also passed the Files, File Collections, and Scene Workspace flows. Documents remains additive and exposes no upload/update/delete/download actions.                                                                                                                                                                                                                        |

### Final independent command evidence

| Command                                                                                                    | Result                                                                                                            |
| ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `yarn test --selectProjects browser --runInBand src/__tests__/components/artifacts/DocumentsPage.test.tsx` | Passed: 3 tests.                                                                                                  |
| `yarn test:e2e e2e/documents.spec.ts`                                                                      | Passed: setup plus 2 Documents specs.                                                                             |
| `yarn test:ci --runInBand`                                                                                 | Passed: 27 suites / 162 tests, including `documents-contract.test.ts` against Docker MockServer.                  |
| `yarn test:e2e`                                                                                            | Passed: 7 tests, including Documents plus existing Files, File Collections, and Scene Workspace regression flows. |
| `yarn api:generate:check`                                                                                  | Passed.                                                                                                           |
| `yarn lint`                                                                                                | Passed with no warnings/errors.                                                                                   |
| `yarn build`                                                                                               | Passed.                                                                                                           |
| `git diff --check`                                                                                         | Passed.                                                                                                           |

### Remaining explicit limitation

Export creation remains intentionally feature-gated. `POST /api/exports`
returns a clear 503 before client creation and the Exports tab cannot create,
poll, or download. This is accepted as the safe behavior until an authoritative
Vertex export format/config/expiry profile is supplied; re-enabling it requires
the deferred export-specific contract and browser validation described above.

## Final disposition

**Accepted — Documents Preview and the safe Exports capability gate.** The
previous Documents coverage and cursor-reset blockers are resolved and all
required quality gates passed. This does **not** accept an active Vertex export
creation workflow; it remains deliberately deferred behind the documented
feature gate.
