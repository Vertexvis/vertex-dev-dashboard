# Validation — framework / API-resource catalog

## Scope reviewed

- Worktree: `/private/tmp/vertex-dev-dashboard-vertex-api-exercise`
- Reviewed the framework, Files migration, generator/manifest, and deterministic
  Playwright harness against handoffs 01, 02, 03, and 05.
- This is an independent review; implementation claims were not treated as evidence.

## Commands and results

| Command                                                                                                                   | Result                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `yarn api:generate:check`                                                                                                 | Passed. The current single `files` manifest entry renders without drift.                                                                                                                                |
| `yarn lint`                                                                                                               | Passed; no warnings/errors.                                                                                                                                                                             |
| `yarn test --selectProjects browser --runInBand src/__tests__/lib/api-client.test.ts src/__tests__/lib/api-query.test.ts` | Passed: 4 tests.                                                                                                                                                                                        |
| `yarn test --selectProjects node --runInBand src/__tests__/pages/api/api-framework.test.ts`                               | Passed: 4 tests.                                                                                                                                                                                        |
| `yarn test --selectProjects browser --runInBand src/__tests__/components/file/FileTable.test.tsx`                         | Passed: 6 tests (existing Files sorting/filter/loading UI coverage).                                                                                                                                    |
| `yarn test:e2e`                                                                                                           | Passed: 3 Playwright tests (authenticated Files fixture render and visible error state). Initial sandbox attempt could not bind port 3100; the same command passed when run with local port permission. |
| `yarn build`                                                                                                              | Passed.                                                                                                                                                                                                 |
| `git diff --check`                                                                                                        | Passed. No whitespace errors or unrelated formatter churn were observed.                                                                                                                                |
| `yarn test --selectProjects node --runInBand src/__tests__/pages/api/files.test.ts`                                       | **Not run to completion**: Testcontainers failed before the test body with `Could not find a working container runtime strategy`.                                                                       |

## Findings

### 1. BLOCKER — generator can overwrite developer-owned route/client source

Severity: **high (data loss / generator safety)**

The required contract says the generator writes only files carrying the generated
header. It does not enforce that contract. In
`scripts/generate-api-resource.mjs` lines 156–166, any existing content that differs
from the template is unconditionally passed to `writeFile`; no header check occurs.

Reproduction (do not run against this worktree without a disposable copy): add a valid
manifest entry with `route: "health"`, then run
`node scripts/generate-api-resource.mjs --resource <entry-name>`. The generator will
replace the existing developer-owned `src/pages/api/health.ts`, which has no generated
header. The same issue applies to an existing resource client path.

The manifest is also not checked for duplicate output paths, and `displayName` is
interpolated into a quoted TypeScript string in the hooks template without validation
or escaping (line 89). A manifest display name containing a quote can emit invalid or
injected TypeScript. This violates the plan's restriction that template values be
identifiers/JSON data rather than code fragments.

Required rework:

- Before writing an existing generated target, require the exact generated header;
  otherwise fail without modifying it. Keep developer-owned hooks create-only.
- Validate duplicate names, routes, and all derived target paths before any write.
- Validate required display fields and serialize interpolated strings with
  `JSON.stringify` (or avoid code interpolation altogether).
- Add generator tests for header refusal, duplicate paths, hostile display strings,
  hooks preservation, idempotence, and `--check` drift.

### 2. BLOCKER — declared `get`/`update` operations generate unusable API routes

Severity: **high (future generated resources cannot implement their declared API)**

`createResourceClient` emits `GET /api/<route>/:id` and `PATCH /api/<route>/:id` for
`get`/`update`, but `generatedFiles` only creates `src/pages/api/<route>.ts` (lines
108–120). It never creates `<route>/[id].ts`. The hooks template also maps both
`list` and `get` to the same `GET` operation and deduplicates the generated line
(lines 80–92), so a manifest containing both operations cannot distinguish a list
from a detail action. The present Files manifest avoids those operations, but this
breaks the stated generator framework as soon as a normal CRUD resource is added.

Required rework:

- Extend manifest semantics to describe collection versus detail routes, generate
  the dynamic `[id]` handler where needed, and give each handler only its valid
  operation(s).
- Make the generated hooks/spec use explicit path-param parsing for detail routes.
- Add semantic generator tests that render list/get/create/update/remove resources
  and prove generated client paths and allowed methods match actual handlers.

### 3. BLOCKER — Files `POST` accepts invalid bodies and reaches the upstream client

Severity: **high (mutable route validation / contract regression)**

The SDK declares `CreateFileRequestDataAttributes.name` as required. The new
`POST` parser at `files.hooks.ts:99–108` only calls `parseJsonBody`; `{}`, `[]`,
`null` (when sent as the JSON string `"null"`), and objects with unknown fields are
cast to `CreateFileReq` and passed to `client.files.createFile`. The framework plan
and validation plan require invalid bodies to return 400 and make no upstream call.
The existing test suite has no Files create/delete/error/malformed-body contract cases;
the one Docker-backed Files test only covers list/sort.

Required rework:

- Add a resource-owned Files create validator that requires a plain object with a
  non-empty string `name`, validates optional field types, and rejects unknown fields
  (or explicitly allowlist documented fields) before `execute`.
- Make `parseJsonBody` treat JSON `null` as a missing/invalid body for object request
  contracts, or perform that check in the parser above.
- Add non-container unit tests proving invalid POST/DELETE requests do not invoke the
  client, plus MockServer contract cases for successful create/delete and upstream
  4xx/5xx mapping when Docker is available.

### 4. BLOCKER — E2E authentication bypass uses a committed, predictable secret

Severity: **medium (test-mode session boundary)**

The endpoint is properly absent in production and requires `E2E_TEST_MODE=true`, but
the Playwright configuration commits and supplies the fixed value
`local-e2e-session-secret` (`playwright.config.ts:28`; `e2e/auth.setup.ts:7`). Any
non-production deployment/process started with that command has a predictable request
header that can mint an authenticated iron-session cookie. The validation plan requires
a random local secret; this implementation does not provide one. There is also no
negative test for a missing/wrong secret or production/test-mode denial.

Required rework:

- Generate an ephemeral secret for the Playwright run (not a checked-in literal) and
  pass it to both the web server and setup request through process configuration.
- Limit the endpoint to the explicit intended test environment/local process as
  tightly as the Next test architecture permits; keep the current fail-closed default.
- Add handler tests for wrong method, absent/wrong secret, disabled mode, and successful
  bootstrap; assert no real Vertex host is contacted.

## Browser and credential-boundary assessment

- The Playwright flow genuinely opens `/files` under the saved local session and
  observes the rendered Files heading, fixture row, and an error state. It did not
  expose the fixture token in the assertions/output.
- The Files data requests are fulfilled with `page.route("**/api/files**")`, so this
  smoke test validates browser rendering/request handling but deliberately does **not**
  exercise the migrated server handler or raw Vertex transport. That server parity
  remains gated by the Docker MockServer test and the missing create/delete cases.
- The production guard plus explicit test-mode flag is a good starting boundary, but
  the predictable secret finding above prevents acceptance.

## Test coverage gaps relevant to acceptance

- Lifecycle tests do not cover `onError`, error normalization variants, transform-query
  behavior, async short-circuit failures, or a malformed Files request that proves no
  resource API call occurs.
- There are no generator tests despite the framework plan requiring idempotence,
  `--check` drift, descriptor validation, and developer-hook preservation tests.
- Files route parity is not established: Docker/Testcontainers prevented the existing
  GET test from running, and mutation/error contract cases were not added.

## Disposition

**Rejected — return to implementor.** Fix findings 1–4 and add the stated regression
coverage. Then rerun generator check, lint, focused framework/client/query/Files tests,
Playwright, build, and the Files MockServer contract suite on a Docker-capable runner.
The Docker limitation is an external gate only after the implementation blockers are
resolved; it cannot establish acceptance by itself in the current state.

---

## Revalidation — 2026-07-21

I independently reviewed the rework described in handoff 05 and retested every
original blocker. This section supersedes the preceding disposition only where stated.

### Evidence run

| Command                                                                                                                                                                                                                            | Result                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `yarn api:generate:check`                                                                                                                                                                                                          | Passed.                                                                                                                                                                        |
| `yarn lint`                                                                                                                                                                                                                        | Passed; no warnings/errors.                                                                                                                                                    |
| `yarn test --selectProjects node --runInBand src/__tests__/pages/api/generator.test.ts src/__tests__/pages/api/files-validation.test.ts src/__tests__/pages/api/e2e-session.test.ts src/__tests__/pages/api/api-framework.test.ts` | Passed: 22 tests.                                                                                                                                                              |
| `yarn test --selectProjects browser --runInBand src/__tests__/lib/api-client.test.ts src/__tests__/lib/api-query.test.ts src/__tests__/components/file/FileTable.test.tsx`                                                         | Passed: 10 tests.                                                                                                                                                              |
| `yarn test:e2e`                                                                                                                                                                                                                    | Passed with the new random-secret launcher: 3 Playwright tests. First sandbox run was blocked from binding port 3100; the identical command passed with local port permission. |
| `yarn build`                                                                                                                                                                                                                       | Passed.                                                                                                                                                                        |
| `git diff --check`                                                                                                                                                                                                                 | Passed; no whitespace regression observed.                                                                                                                                     |
| `yarn test --selectProjects node --runInBand src/__tests__/pages/api/files.test.ts`                                                                                                                                                | Still blocked before test execution: Testcontainers reports `Could not find a working container runtime strategy`.                                                             |

### Original blockers rechecked

1. **Generator ownership, duplicate preflight, hostile display strings, and idempotence — resolved.**
   `scripts/generate-api-resource.mjs` now preflights the full manifest, refuses
   unheaded generated targets before writes, detects duplicate resource/route/output
   paths, creates hooks only when absent, and JSON-serializes the display string.
   The independent `generator.test.ts` passed its non-overwrite, duplicate,
   quoted-display, collection/detail, drift, and hooks-preservation cases.

2. **Generated detail-route semantics — resolved.**
   The generator separately creates the collection handler for list/create and
   `src/pages/api/<route>/[id].ts` for get/update/remove, with a detail-only spec and
   `requiredPathParam` parser. The independent generator test generated all five
   operations and verified the separate imports/spec names and detail methods.

3. **Predictable E2E session secret and guards — resolved.**
   `scripts/run-playwright-e2e.mjs` supplies freshly generated 32-byte secrets to the
   Playwright process; config/setup no longer contain a fixed secret. Independent guard
   tests passed for wrong method, disabled mode, missing/wrong secret, production, and
   successful bootstrap. The browser suite passed using the random-secret launcher.

4. **Files request validation — partially resolved, but a new bypass remains.**
   Plain-object validation now correctly covers the previously tested missing/array/null,
   invalid-name, unknown-field, metadata, and invalid-delete cases; the 13 parameterized
   invalid-body cases passed without invoking the mocked Files client.

### Remaining implementation blocker

#### BLOCKER — client-controlled `{ message, status }` bodies bypass Files validation

Severity: **high (invalid mutable request can select arbitrary response status/body)**

In `files.hooks.ts:120–126` and `160–166`, a parsed request is first classified by
the structural `isErrorRes` predicate. A user can therefore submit a syntactically valid
but invalid request body such as:

```json
{ "message": "attacker-controlled", "status": 200 }
```

for either `POST /api/files` or `DELETE /api/files`. It satisfies `isErrorRes`, is
returned from the operation parser, and `createVertexRoute` then serializes it directly
at `route.ts:160–163`. The normal Files create/delete validators are skipped. Thus the
response is `200` with the attacker-provided body and no resource API call, rather than
the required 400 `Invalid body.` response. Any numeric status can be selected.

This is not covered by the new malformed-body tests, which test `{}`, arrays, null,
and selected invalid fields but not the response-shaped input.

Required rework:

- Do not identify parse failures by a structural `ErrorRes` shape for untrusted parsed
  JSON. Distinguish the parser's own `BodyRequired`/`InvalidBody` sentinel results
  (for example by explicit identity/discriminant), then run every other parsed JSON
  value through the resource validator.
- Add POST and DELETE regression cases for `{ "message": "x", "status": 200 }`
  and an arbitrary non-2xx numeric status. Each must return the fixed 400 invalid-body
  response and leave both resource client methods uncalled.

### Remaining external gate

The Docker/Testcontainers MockServer Files contract test cannot run in this environment,
so exact raw Vertex request/header/query parity remains an external CI/Docker-capable
gate. This is not the reason for the current rejection; the response-shaped body bypass
is an implementation defect.

### Revalidation disposition

**Rejected — return to implementor for the remaining Files parser bypass.** The three
other original implementation blockers are resolved. After the parser change and new
regression tests, rerun the focused Node suite, generator check, lint, Playwright, and
build; run the Docker-backed Files contract suite in a Docker-capable environment before
final acceptance.

---

## Final parser-bypass revalidation — 2026-07-21

### Independent code assessment

The repair is correct for the reported bypass. `parseJsonBody` still returns the shared
`BodyRequired` and `InvalidBody` objects for parser-originated failures, while the new
`isBodyParseError` accepts only those exact object identities. The Files POST and DELETE
parsers use that narrow predicate before their resource validators. A JSON object decoded
from an HTTP body is a distinct object, so a caller-supplied `{ "message": "x", "status":
200 }` or `{ "message": "x", "status": 451 }` proceeds to validation and receives the
fixed invalid-body response; it cannot be treated as a route result.

This does not alter the dispatcher lifecycle: resource parsers still return genuine
framework parser errors as `ErrorRes`, and `createVertexRoute` retains its established
short-circuit behavior for operation parse/query results. Existing lifecycle tests passed
with the new sentinel helper in place.

### Evidence run

| Command                                                             | Result                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `yarn api:generate:check`                                           | Passed.                                                                                                                                                                                                                                              |
| `yarn lint`                                                         | Passed; no warnings/errors.                                                                                                                                                                                                                          |
| focused Node framework/generator/Files-validation/E2E-session tests | Passed: 26 tests. The Files tests explicitly cover response-shaped POST and DELETE bodies with status `200` and `451`, assert fixed `{ message: "Invalid body.", status: 400 }`, and assert the corresponding resource client method was not called. |
| focused browser client/query/Files-table tests                      | Passed: 10 tests.                                                                                                                                                                                                                                    |
| `yarn test:e2e`                                                     | Passed: 3 Playwright tests using the ephemeral-secret launcher. Port binding required local permission in this environment.                                                                                                                          |
| `yarn build`                                                        | Passed.                                                                                                                                                                                                                                              |
| `git diff --check`                                                  | Passed.                                                                                                                                                                                                                                              |

### Remaining external gate

`src/__tests__/pages/api/files.test.ts` remains unexecutable here because Testcontainers
cannot find a container runtime. Exact Files raw-Vertex request/header/query parity must
still run in CI or another Docker-capable environment. This is an environment limitation,
not an implementation failure found in this final revalidation.

### Final disposition

**Accepted, conditional on the documented Docker/MockServer CI gate.** All implementation
blockers from the independent review, including the parser bypass, are resolved and the
available validation gates pass.
