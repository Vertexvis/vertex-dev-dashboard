# Vertex API exercise — test-harness migration validation

## Verdict

**Accepted.** The Core membership, Scene Workspace, and Documents API contract
suites are correctly migrated from the removed MockServer/Testcontainers
pattern to the PR #326 exported-handler, authenticated-session, Node MSW
harness. The migration changes tests only.

## Scope review

The worktree diff is limited to:

- `src/__tests__/pages/api/file-collection-membership.test.ts`
- `src/__tests__/pages/api/scene-workspace-contract.test.ts`
- `src/__tests__/pages/api/documents-contract.test.ts`
- the migration handoff (`20-test-harness-migration.md`)

The three suites all:

1. Import an exported raw handler, rather than a `withSession` wrapper.
2. Invoke it through `invokeNextJsApiRouteHandler`.
3. Supply `createAuthenticatedVertexApiTestSession("https://vertex-api.test")`.
4. Install the shared Node MSW server at suite scope.
5. Stub exact Vertex API paths with scenario-local MSW handlers.

`rg` finds no `MockServer`, `Testcontainers`, `startMockServer`, or Docker
dependency in any migrated suite. The shared MSW setup rejects unhandled
outbound requests, so these tests do not silently reach a real Vertex API.

## Contract-coverage review

- **Collection membership:** asserts POST JSON body, DELETE
  `filter[fileId]`, typed 409 mapping, and invalid parent ID makes no
  upstream request.
- **Scene Workspace:** asserts item supplied-ID/pagination query
  serialization, view pagination serialization, and 403/500 error-envelope
  mapping with the default page size.
- **Documents:** asserts list filter/pagination serialization, completed-file
  gate plus JSON:API POST body, typed detail retrieval, and list/detail
  403/404 error mapping.

Those assertions preserve the prior MockServer test intent while moving the
transport boundary to MSW. The exact path is enforced by each MSW route;
outbound query/body details are inspected where behavior depends on them.

## Verification run independently

| Command                                             | Result                            |
| --------------------------------------------------- | --------------------------------- |
| `yarn test --selectProjects node --runInBand`       | Passed: 15 suites, 103 tests      |
| `yarn lint`                                         | Passed with no warnings or errors |
| `yarn build`                                        | Passed                            |
| `yarn prettier --check` for migration files/handoff | Passed                            |
| `git diff --check`                                  | Passed                            |

Expected SDK `console.error` entries appeared only for deliberately stubbed
error scenarios; their route-response assertions passed.
