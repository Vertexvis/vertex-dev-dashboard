# Exports and Documents implementation handoff

## Scope delivered

This increment is additive. It leaves existing Files, File Collections, Parts,
Scenes, Viewer, and Scene Workspace read workflows unchanged.

- Adds an **Exports** tab to Scene Workspace. It starts a closed STEP export
  request for the current scene (optionally the already selected saved state),
  polls a known queued export, and provides a click-time download only after a
  terminal result.
- Adds a standalone **Documents (Preview)** page and an additive drawer entry.
  It supports list/filter, registration from a completed File, and typed detail
  route support. It intentionally exposes no document upload/update/delete/
  download operation.

## SDK/reference support matrix (checked 2026-07-21)

| Operation                         | Official docs / SDK 0.44.0                                                                    | Delivery                                                                                                                                          |
| --------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Export start                      | `POST /exports`; `ExportsApi.createExport`, typed `CreateExportRequest`, returns `QueuedJob`  | Delivered at `POST /api/exports` with closed body; scene is checked, and optional state is verified by the scene-scoped state list.               |
| Queued poll                       | `GET /queued-exports/:id`; `ExportsApi.getQueuedExport`, running/error or completion redirect | Delivered at `GET /api/queued-exports/:id`. Axios redirect-follow terminal `Export` is detected and normalized locally; no Location is forwarded. |
| Export detail                     | `GET /exports/:id`; `ExportsApi.getExport`                                                    | Delivered at `GET /api/exports/:id`, with `downloadUrl` stripped.                                                                                 |
| Export download                   | `ExportData.attributes.downloadUrl` is short lived/recreated by get                           | Delivered only at `POST /api/exports/:id/download-url`, `Cache-Control: no-store`.                                                                |
| Documents Preview list/create/get | `DocumentsApi.getDocuments/createDocument/getDocument`; docs mark all Preview                 | Delivered via generated Documents route/client plus developer-owned typed hooks.                                                                  |

The public reference describes `config.format` as a string and does not publish
an enum. The UI/route exposes **only `step`**, based on current Vertex support
documentation describing STEP as an export format. This is an explicit
validator gate: verify the exact case/token against a real Platform account or
an authoritative Postman example before accepting production use. There is no
free-form format/config input and no untyped transport fallback.

## Key implementation details

- `src/lib/api/route.ts` now parses route input/query before client creation;
  malformed generated-resource input makes no Vertex client call.
- `src/lib/artifacts.ts` owns the closed export contract: `step`, nonblank
  opaque IDs, safe filename (no slash/null), and 60..86400 second expiry.
- Regular export responses contain only ID, created time, expiry, and File
  relationship ID. The URL cannot enter SWR state, DOM, history, logs, or the
  recent status card. The download component holds it only in a local function
  variable and opens it with `noopener` (or falls back to same-window nav).
- Documents creation reads the selected File through the typed SDK and permits
  only normalized `complete` status. List bounds page size at 100 and accepts
  the documented comma-separated `filter[suppliedId]` mapping through SDK.

## Tests and checks run

| Check                                        | Result                                                                                                                                                            |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `yarn build`                                 | Passed (lint import-order warnings only).                                                                                                                         |
| `yarn lint`                                  | Passed (same non-blocking import-order warnings).                                                                                                                 |
| `yarn api:generate:check`                    | Passed.                                                                                                                                                           |
| Focused Node route/framework/generator tests | Passed: 12 tests. Includes validation-before-client, exact closed export request, queued normalization, redaction/no-store behavior, and Documents typed mapping. |
| Focused Scene Workspace component test       | Passed. Existing read-only workspace/view-state behavior remains intact.                                                                                          |
| `git diff --check`                           | Passed.                                                                                                                                                           |

### Follow-up: linked source File

- The lazy Documents detail drawer now renders its associated File ID with the
  shared `ResourceLink` component. Its fallback `href` and client-side primary
  action both target the existing `/files` dashboard route, preserving SPA
  navigation semantics.
- Focused component coverage asserts the accessible File link, its `/files`
  destination, and the client-side router action.

| Check                                                                             | Result                          |
| --------------------------------------------------------------------------------- | ------------------------------- |
| `yarn test --runInBand src/__tests__/components/artifacts/DocumentsPage.test.tsx` | Passed: 3 tests.                |
| `yarn lint`                                                                       | Passed with no warnings/errors. |

### Follow-up correction: direct File view state

- Both associated File IDs (Documents table and lazy detail drawer) now use
  the established direct File view state, `/files?fileId=<id>`, rather than
  the generic `/files` destination. Each uses `ResourceLink` with a Next
  client-side route push to `{ pathname: "/files", query: { fileId } }`.
- Focused component coverage independently asserts both link locations and
  their selected File router state.

| Check                                                                             | Result                          |
| --------------------------------------------------------------------------------- | ------------------------------- |
| `yarn test --runInBand src/__tests__/components/artifacts/DocumentsPage.test.tsx` | Passed: 3 tests.                |
| `yarn lint`                                                                       | Passed with no warnings/errors. |

## Not passed / validator checklist

1. Add/execute Docker MockServer contracts for actual `/exports`,
   `/queued-exports/:id`, `/exports/:id`, and Documents serialization. These
   were not added in this implementation pass.
2. Extend the controlled Playwright fixture to exercise Export start → queued
   → terminal → download and Documents Preview. No real Platform credentials or
   outbound host access was used here.
3. Verify `step` is the exact accepted Platform export config token and verify
   Axios redirect behavior against MockServer (the implementation safely handles
   auto-followed terminal Export data, but does not intercept a raw Location).
4. Adversarially test state ownership across pagination (current server check
   uses the first bounded scene-state page), 403 Preview handling, missing or
   expired download URLs, queued error diagnostics, and UI polling cancellation.
5. Verify no existing Scene/Viewer/File UX changed; this increment only adds a
   tab, a drawer destination, and new local API routes.

---

## Rework after validation 16

### Resolved safety and UX findings

- **Unverified export mutation removed/gated.** The public API and pinned SDK
  still provide only an unconstrained `config.format: string`; no authoritative
  current STEP token/options/expiry profile was obtainable. `POST /api/exports`
  now returns a fixed 503 without creating a client or making an upstream call,
  and the Workspace tab is an explicit capability notice with no create form,
  queue polling, download control, or URL state. This removes the unsafe guessed
  contract and makes polling cancellation/backoff inapplicable until a verified
  start profile is approved.
- **Queued redirect boundary hardened.** `GET /api/queued-exports/:id` invokes
  the typed SDK with `maxRedirects: 0` and a narrow 200/3xx status policy. A 3xx
  Location is parsed only relative to the configured base path and accepted only
  for the exact same-origin `/exports/<opaque-id>` path with no query/hash;
  otherwise it returns local 502. A validated ID is then fetched through typed
  `getExport`; no Location reaches the browser.
- **Documents Preview capability state delivered.** A local `{status:403}` list
  envelope produces an explicit read-only capability message and disables
  registration while leaving the rest of the dashboard unaffected. The page now
  includes cursor-next/first controls and a lazy typed details drawer; destructive
  and unsupported document actions remain absent.
- **Quality warnings resolved.** `yarn lint --fix` followed by `yarn lint` is
  warning-free.

### Rework evidence

| Check                             | Result                                                                                                                                                                                                          |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Artifacts Node route suite        | Passed: 6 tests, including gated start, no-client/no-request guarantee, normal redaction/no-store download, queued no-follow options, same-host terminal resolution, off-host rejection, and Documents mapping. |
| Documents Preview component suite | Passed: Preview 403 disables registration and presents capability copy.                                                                                                                                         |
| `yarn build`                      | Passed.                                                                                                                                                                                                         |
| `yarn lint`                       | Passed with no warnings.                                                                                                                                                                                        |

### Remaining independent-validation targets

The former start/queued/download browser workflow cannot run because creation is
intentionally gated; it must be reintroduced only with a verified export format
profile and then receive its dedicated MockServer/Playwright contract suite.
The new redirect resolver has focused unit coverage, but a validator should add
or execute a Docker MockServer 302 response to independently prove Axios does
not follow the Location. Documents list/detail/pagination and Preview 403 have
component coverage; a controlled browser smoke remains desirable.

---

## Documents repair after validation 16

### Resolved validation requirements

- Applying the supplied-ID filter now resets the Documents cursor before the
  new SWR key is requested, so the filtered list always begins at its first
  page.
- Added a checked-in Docker MockServer route contract suite for Documents list,
  completed-File-gated create, typed detail, and Preview 403/detail 404 error
  mapping. It verifies the SDK's cursor/filter query serialization and the
  JSON:API create payload.
- Added deterministic local Playwright coverage for list, next-page,
  filter-after-pagination cursor reset, lazy detail, successful registration,
  and Preview 403 read-only handling. All browser responses are locally
  intercepted; no Platform credentials are used.
- The contract test exposed and fixed two route hardening issues: omitted
  `pageSize` now correctly falls back to 25, and the Documents error hook no
  longer calls the SDK's `isFailure` helper with an absent response.

### Repair verification

| Check                                                                                            | Result                                                                 |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `yarn test --selectProjects node --runInBand src/__tests__/pages/api/documents-contract.test.ts` | Passed: 4 Docker MockServer contracts.                                 |
| `yarn test --runInBand src/__tests__/components/artifacts/DocumentsPage.test.tsx`                | Passed: 2 tests, including cursor reset and Preview 403.               |
| `yarn test:e2e e2e/documents.spec.ts`                                                            | Passed: Documents registration/detail/filter/pagination and 403 flows. |
| `yarn api:generate:check`                                                                        | Passed.                                                                |
| `yarn lint`                                                                                      | Passed with no warnings/errors.                                        |
| `yarn test:ci --runInBand`                                                                       | Passed: 27 suites / 161 tests.                                         |
| `yarn test:e2e`                                                                                  | Passed: 7 tests, including Documents.                                  |
| `yarn build`                                                                                     | Passed.                                                                |
| `git diff --check`                                                                               | Passed.                                                                |
