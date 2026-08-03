# Validation plan: generated Vertex API exercise

## Purpose and release gate

Use this protocol for the framework PR and for every subsequent API-group PR. A
group may not be accepted until its own tests pass, it has been smoke-tested in
a real browser against deterministic local responses, and the cumulative
quality commands below pass. Keep the evidence (commands, results, screenshots
when useful, and any failure/rework notes) in that group's handoff/PR.

The generated framework must not merely be covered indirectly by the first
group. Test its public contract once, then add small declarative tests per
group/override. The contract includes route dispatch, supported method list,
query/body/path mapping, session-derived Vertex client creation, response
mapping, error mapping, lifecycle-hook order, and the guarantee that a hook
cannot bypass the standard authorization/error boundary accidentally.

## Existing validation assets

| Layer               | What exists                                                                                                                                                                                                                                | Recommended use                                                                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Handler integration | Node Jest project; `test/helpers/mockserver.ts` starts a Testcontainers MockServer. Existing `files`, `file-jobs`, and file-collection route tests call exported raw handlers with a fake iron-session and verify exact upstream requests. | Primary API-route test pattern. It validates the Vertex SDK/axios request actually emitted, including URL, method, headers/query/body, and mapped result. Docker is required. |
| Client components   | Browser/JSDOM Jest project with Testing Library, MSW 2, `test/msw/installJsdomMockServer.ts`, and `test/render/renderWithSWR.tsx`. Existing table tests exercise pagination, filters, selection, mutations, and error display.             | Primary UI/unit-integration test pattern. Register `http.*` handlers per test and assert visible behavior plus request query/body.                                            |
| Build gates         | `yarn lint`, `yarn test:ci` (coverage), and `yarn build` are CI gates in `.github/workflows/build.yml`. `yarn format` is available but writes files.                                                                                       | Run formatter first, inspect its diff, then lint/test/build.                                                                                                                  |
| Browser package     | `playwright@1.61.1` is a dev dependency.                                                                                                                                                                                                   | Not presently usable as a project e2e suite: no `playwright.config.*`, no `e2e/` tests, and no checked-in app/mock bootstrapping.                                             |

## Required tests for the generator/framework PR

1. **Pure generator/descriptor tests (no HTTP):** test every endpoint descriptor
   accepted by the generator and reject malformed descriptors at compile time
   where possible. Assert generated route paths, dynamic parameter names,
   allowed methods, default pagination, request serialization, response shape,
   and generated SWR/client cache keys. Snapshot only stable generated text;
   prefer semantic assertions over broad file snapshots.
2. **Lifecycle tests:** use a spy/event log to prove the documented order—for
   example request normalization → authorization/client creation → `before` →
   operation → `after` → response/error mapping—and prove short-circuit,
   thrown-error, and async-hook behavior. Test that group-specific hooks receive
   typed, validated inputs and cannot turn an unknown exception into a 200.
3. **Handler integration matrix:** for one generated endpoint of each operation
   kind (list, get, create, update, delete, action/upload as applicable), use
   the existing MockServer harness. Verify the exact upstream request and
   successful response. For all kinds, cover unsupported method (405), missing
   / malformed body (400), invalid path/query data (400), 401/403/404/409/422
   upstream failures, 5xx/network failure, and token-refresh/session failure.
   Assert no upstream interaction for validation failures.
4. **Specialization regression:** each non-default sorting/search/filter/custom
   transport hook needs both (a) a handler test proving its upstream request and
   (b) a UI test proving the control changes the local API request and resets
   pagination. This is the main defense against generator defaults silently
   overriding a specialized behavior.
5. **Client adapter/UI contract:** test generated client functions against MSW
   for encoding, response/error parsing, cache key stability, and mutation
   invalidation. Test shared UI primitives once for loading, empty, error,
   pagination, keyboard/accessibility labels, and destructive-action
   confirmation; group tests then cover their configured fields/actions.

Avoid testing the `withSession(...)` wrapper by invoking it directly for each
route. Follow the current pattern: export a raw `handleX` function, inject a
fake `NextIronRequest.session`, and test the wrapper/session helper separately.

## Required validation loop for every API grouping

The planner must add a compact endpoint inventory to the group handoff:
Postman/API group, dashboard route(s), generated descriptor(s), specialized
hook(s), mutating operation(s), and expected user workflow. The validator then
executes this matrix:

| Risk / behavior           | Minimum evidence                                                                                                                                                                  |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Read/list/detail          | Initial loading state, successful data, empty state, paging/cursor behavior, all exposed sorting/search/filter combinations, malformed URL/query handling, and API error display. |
| Create/update/action      | Required-field validation; valid request shape; success feedback and cache refresh/navigation; duplicate/conflict/validation error; retry behavior where offered.                 |
| Delete/destructive action | Item selection, explicit confirmation, cancellation causes no request, success removes/refreshes data, partial failure is surfaced accurately, and repeated click is guarded.     |
| Nested/resource IDs       | URL encoding, wrong/missing ID, not found, and parent-child refresh behavior.                                                                                                     |
| Auth/session              | Unauthenticated page redirects to `/login`; an expired session refreshes the token or yields a safe error; no secret/access token appears in DOM, URL, logs, or client response.  |
| Accessibility/resilience  | Inputs and icon buttons have accessible names; keyboard flow works for primary task; loading does not leave stale data actionable; network failure offers useful recovery.        |

For a group that deliberately exposes only a safe subset of a large API,
validate that the UI describes the supported scope and does not present a
control which cannot complete successfully. Record intentionally omitted API
operations in the handoff; absence is not a test failure if it is explicit.

## Commands and local prerequisites

Run from the worktree. Do not put credentials in a handoff, test artifact, or
committed file.

```sh
yarn install --frozen-lockfile
yarn format
yarn lint
yarn test:ci
yarn build
```

`yarn format` writes source files; review and include only intentional formatting
changes. `yarn test:ci` collects coverage and will start Testcontainers-based
tests, so it requires a running Docker daemon. When Docker is unavailable,
record those tests as **not run**, not passed; run the JSDOM/non-container
subset if a targeted command is available, and rerun the complete suite in CI
or a Docker-capable environment before approval.

For an isolated route test during rework:

```sh
yarn test --selectProjects node src/__tests__/pages/api/<route>.test.ts
```

For an isolated component test:

```sh
yarn test --selectProjects browser src/__tests__/components/<area>/<component>.test.tsx
```

The exact Jest selector syntax should be confirmed after any Jest-config
refactor; the current config names its projects `node` and `browser`.

## Practical browser smoke test (required before group acceptance)

### Current safe manual baseline

1. Create the ignored `.env.local` from `.env.local.template` and set only a
   locally generated `COOKIE_SECRET` of at least 32 characters. Do not reuse a
   production secret.
2. Start `yarn dev -p 3100` and confirm `GET /api/health` returns
   `{ "status": "ok" }`.
3. In a browser, visit `http://localhost:3100/<group-page>`. With no session,
   confirm the server-side page redirects to `/login`. This is the only safe
   live-app smoke test available without API credentials.
4. A credentialed manual smoke must use a dedicated disposable/non-production
   Vertex account and test data. Sign in through `/login`, exercise the group
   workflow above, then remove test data where the API permits. Do not run
   destructive controls against a shared account.

### Required implementation to make it automated and deterministic

The repository contains Playwright as a dependency but `playwright:login`
points to the missing `scripts/test_playwright.js`; there is no Playwright config
or checked-in test suite. Before claiming automated browser coverage, add a
small, explicit e2e harness as part of the framework work:

1. Add `playwright.config.ts` with a local `webServer` (`yarn dev -p 3100` or a
   built start server), `baseURL`, serial/low parallelism, screenshot/trace on
   failure, and an ignored output directory.
2. Add a test-only local upstream stub (preferred: an isolated MockServer
   container/process or an explicit non-production `E2E_NETWORK_CONFIG`), plus
   a documented authenticated session bootstrap. The browser must never call a
   real Vertex environment in CI. Do **not** add a broadly enabled API bypass;
   restrict test mode to `NODE_ENV=test`/an explicit local-only value and fail
   closed otherwise.
3. Add `e2e/auth.setup.ts` to authenticate against the local stub and save a
   Playwright storage state outside version control. If realistic iron-session
   cookie creation is awkward, expose only a test-environment login endpoint
   guarded by a random local secret; test the real login route separately at
   handler level.
4. Add one smoke spec per grouping. It should visit the authenticated page,
   wait for a stable table/detail heading, perform the group’s highest-value
   read/search/create-or-action workflow against fixtures, assert the visible
   result and captured local request, and test one failure state. Keep
   destructive-operation checks fixture-only.
5. Add `yarn test:e2e` and run it after the normal test suite. Install browser
   binaries once in the developer/CI environment with
   `yarn playwright install --with-deps chromium` (or the platform-equivalent
   install) rather than committing browser artifacts.

Until that harness exists, browser testing is manual and cannot be reported as
Playwright coverage. A validator may use the in-app browser to inspect the
local server, but that does not replace a committed reproducible e2e test.

## Known gaps/blockers found during reconnaissance

- `node_modules` is absent in this worktree, so no tests/build/browser run was
  attempted here.
- Docker/MockServer availability could not be confirmed; handler integration
  tests depend on it via `@testcontainers/mockserver`.
- The only MSW fixture helpers currently cover file collections. New group
  tests should add typed fixtures/handlers by resource, avoiding a mutable
  global catch-all response.
- The API test coverage is currently concentrated in files, file jobs, and
  file collections. Existing parts/scenes and other routes should be brought
  under the same raw-handler/MockServer contract as framework migration
  touches them; do not let generation reduce their current behavior.
- There is no checked-in Playwright configuration, e2e spec, login bootstrap,
  or `scripts/test_playwright.js` despite the package script. Treat the script
  as stale until replaced or removed by the framework/e2e PR.
- `COOKIE_SECRET` is the only local env variable in the template and is used by
  `next-iron-session`; authenticated browser tests need a deliberate local
  session strategy in addition to that value.

## Validator handoff template

```md
## Validation — <API group>

- Commit/PR and group descriptor:
- Routes and user workflow tested:
- Generator/lifecycle tests:
- Handler integration cases and MockServer evidence:
- UI/MSW cases:
- Browser smoke (fixture URL, spec/manual steps, result):
- `format` / `lint` / `test:ci` / `build` results:
- Not-run checks and reason:
- Defects found, severity, and exact reproduction:
- Rework requested / final disposition:
```

Any failed requirement, upstream-request mismatch, client-visible error that is
missing/misleading, untested mutation, or unavailable quality gate returns the
group to its implementer with this completed template. The next validator must
retest the original failure plus the relevant regression matrix; do not accept
a verbal assertion that the loop was fixed.
