# Framework implementation handoff

## Delivered scope

- Added the Pages Router API route framework in `src/lib/api/`: stable contracts,
  lifecycle dispatcher, safe JSON parsing/error normalization, declarative cursor/filter/sort
  parsing, and same-origin browser client helpers.
- Added `api-resources.json` plus the dependency-free `scripts/generate-api-resource.mjs`.
  It validates manifest slugs/operations, generates only header-tagged route/client files,
  creates developer-owned hooks only when absent, and supports `--resource` and `--check`.
- Added package commands `api:generate`, `api:generate:check`, and `test:e2e`; replaced the
  stale missing `playwright:login` script with the Playwright setup project.
- Migrated `/api/files` as the sole proof resource. Its generated thin route remains session
  wrapped; its developer-owned hook retains the raw JSON:API list request, filters, cursor
  paging, allowed sort fields, create/delete behavior, and server-only Vertex credentials.
  File request/response types now live in the resource contracts module rather than the page route.
- Added a minimal deterministic Playwright harness. `api/test/e2e-session` is disabled unless
  all of these are true: non-production runtime, `E2E_TEST_MODE=true`, and a matching
  `E2E_SESSION_SECRET` header. Browser specs intercept only local `/api/files` fixtures; no
  Vertex host is contacted.

## Test coverage added

- Framework lifecycle/JSON parser tests: method rejection, lifecycle order, transformed input,
  validation short-circuit, and an `afterResponse` failure not changing an already-sent result.
- Query tests: cursor/filter encoding, page-size clamping, and sort allowlisting.
- Browser-client tests: deterministic cache keys, JSON mutation headers/bodies, and parsed error
  responses on a non-2xx local API response.
- Playwright Files smoke: guarded session bootstrap, successful local fixture render, and visible
  error state.

## Verification performed

| Command                                           | Result                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------- |
| `yarn install --frozen-lockfile`                  | Passed                                                              |
| `yarn format`                                     | Passed; reverted unrelated baseline-only formatter churn afterward  |
| `yarn lint`                                       | Passed with no warnings/errors                                      |
| `yarn api:generate:check`                         | Passed                                                              |
| focused browser framework/client/query Jest tests | Passed (4 tests)                                                    |
| focused node framework Jest test                  | Passed (4 tests)                                                    |
| `yarn test:e2e`                                   | Passed (3 Playwright tests); required local port-binding permission |
| `yarn build`                                      | Passed                                                              |

## Not run / blocker

- The existing Files MockServer contract test was attempted but could not start because this
  environment has no working Docker/Testcontainers runtime (`Could not find a working container
runtime strategy`). This is an environment limitation, not an asserted pass. Run
  `yarn test --selectProjects node --runInBand src/__tests__/pages/api/files.test.ts` on a
  Docker-capable runner before accepting Files route parity.
- The complete Jest suite / `test:ci` was not run because the suite includes the same
  Docker-dependent contract tests. The validator should run it in CI or with Docker available.

## Reviewer tips

- Start at `src/pages/api/files.ts` -> `files.hooks.ts`: generic transport stops at the hook;
  the resource owns its SDK/raw JSON:API behavior.
- Confirm the generator never overwrites `*.hooks.ts` and `yarn api:generate:check` stays clean
  after an intentional generated-file edit/rebuild check.
- For the browser harness, verify the test endpoint remains fail-closed outside explicit local
  test configuration and that request interception is limited to the local Files API path.
- Re-run the existing Docker-backed Files route test to confirm exact Vertex headers/query/body
  behavior after the migration.

## Rework after independent validation (2026-07-21)

### Blockers resolved

1. **Generator ownership and manifest safety**

   - The generator now preflights every manifest entry before any writes, rejects duplicate
     resource names/routes/derived output paths, validates non-empty display names, and serializes
     display strings with `JSON.stringify`.
   - Existing generated route/client files must carry the exact generated header; otherwise the
     command refuses to modify them. Hooks remain create-only and are never overwritten.
   - The generator now supports `API_RESOURCE_ROOT` solely for isolated test roots.

2. **Collection/detail route generation**

   - `list`/`create` generate the collection route, while `get`/`update`/`remove` generate
     `src/pages/api/<route>/[id].ts` with its own detail spec and explicit ID parser.
   - The Files proof resource keeps its specialized batch DELETE in its developer-owned collection
     hook; its manifest therefore declares only the generator-owned list/create surface.

3. **Files mutable-body validation**

   - Files POST now only accepts a plain object with a non-empty `name`; optional `suppliedId`,
     `rootFileName`, `expiry`, and string-valued `metadata` are type-checked, and unknown fields
     are rejected. JSON `null`, arrays, and malformed/missing bodies return 400.
   - DELETE now also requires an exact, non-empty `ids` array request object before a resource API
     call.

4. **Ephemeral E2E session secret**
   - `scripts/run-playwright-e2e.mjs` creates one random session secret and cookie secret per run,
     then passes them to Playwright workers and the explicit local dev server. No predictable secret
     is checked in.
   - The session route remains fail-closed for production, disabled mode, missing/wrong secret, and
     wrong method. Unit tests cover each guard and the successful local bootstrap.

### Rework tests and checks

| Command                                  | Result                                                    |
| ---------------------------------------- | --------------------------------------------------------- |
| node generator safety/detail-route tests | Passed (3 tests)                                          |
| node Files request-validation tests      | Passed (13 malformed POST/DELETE cases)                   |
| node E2E session-guard tests             | Passed (2 tests)                                          |
| existing node lifecycle tests            | Passed (4 tests)                                          |
| `yarn api:generate:check`                | Passed                                                    |
| `yarn lint`                              | Passed with no warnings/errors                            |
| `yarn test:e2e`                          | Passed (3 tests) with launcher-generated ephemeral secret |
| `yarn build`                             | Passed                                                    |

The Docker/Testcontainers Files MockServer test remains not runnable in this environment because
there is no container runtime; this remains the only outstanding environment-gated verification.

## Final parser-bypass repair

- Replaced the Files resource's structural `ErrorRes` recognition with
  `isBodyParseError`, which only accepts the framework's own `BodyRequired` and
  `InvalidBody` sentinel object identities. Every JSON value supplied by a caller,
  including an object shaped like an error response, now reaches the resource validator.
- Added POST and DELETE regressions for `{ "message": "x", "status": 200 }` and
  `{ "message": "x", "status": 451 }`. Each asserts the fixed 400 `Invalid body.`
  response and no `createFile`/`deleteFile` invocation.

Verification after this repair: focused Files plus lifecycle node tests passed (21 tests),
`yarn api:generate:check`, `yarn lint`, and `yarn build` passed. The Docker/Testcontainers
contract-suite limitation remains unchanged.
