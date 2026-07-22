# Vertex API exercise — API test harness migration

## Scope

- Worktree: `/private/tmp/vertex-dev-dashboard-vertex-api-exercise`
- Baseline: merge commit `a2e3250` (PR #326, new Next.js API handler/MSW test
  harness).
- Product source and UX were intentionally not changed.
- No container/Testcontainers test was added or run.

## Migration completed

The three Vertex API exercise suites that still relied on the removed
MockServer/Testcontainers harness now use the PR #326 pattern:

1. Import an exported raw route handler.
2. Invoke it through `invokeNextJsApiRouteHandler` with
   `createAuthenticatedVertexApiTestSession("https://vertex-api.test")`.
3. Install the shared Node MSW server at file scope.
4. Register per-test `http` handlers that assert the exact SDK request URL,
   query, and JSON body where applicable.
5. Assert the route response envelope.

Migrated files:

- `src/__tests__/pages/api/file-collection-membership.test.ts`
- `src/__tests__/pages/api/scene-workspace-contract.test.ts`
- `src/__tests__/pages/api/documents-contract.test.ts`

Coverage preserved:

- Collection membership add/removal request serialization, typed conflict
  handling, and invalid-parent no-upstream behavior.
- Scene Workspace item/view paging/filter serialization and 403/500 response
  mapping.
- Documents list paging/filter serialization, completed-File-gated JSON:API
  create, typed detail, and Preview 403/detail 404 mapping.

No scripts, Jest configuration, dependencies, API handlers, components, or
pages were changed. The shared Node harness's `onUnhandledRequest: "error"`
behavior means an accidental real or unstubbed Vertex request fails the test.

## Verification

| Command                                       | Result                            |
| --------------------------------------------- | --------------------------------- |
| Focused migrated Node suites                  | Passed: 3 suites / 12 tests       |
| `yarn test --selectProjects node --runInBand` | Passed: 15 suites / 103 tests     |
| `yarn lint`                                   | Passed with no warnings or errors |
| `yarn build`                                  | Passed                            |
| `git diff --check`                            | Passed                            |

Expected SDK error logging appears in tests that deliberately stub 4xx/5xx
Vertex responses; all corresponding assertions pass.

## Independent-validation checklist

- Confirm the changed files are limited to the three API test suites and this
  handoff; product behavior must remain unchanged.
- Run the full Node API project without Docker:
  `yarn test --selectProjects node --runInBand`.
- Review the per-scenario MSW request assertions, particularly membership
  payloads and Documents JSON:API creation, to ensure they retain the original
  contract coverage.
