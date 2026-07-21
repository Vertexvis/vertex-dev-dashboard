# Validation — Scene Workspace

## Scope and independence

- Worktree: `/private/tmp/vertex-dev-dashboard-vertex-api-exercise`
- This is an independent, read-only review of the Scene Workspace work described
  in handoffs 09, 10, and 14, using the framework/Core validation contracts in
  handoffs 07 and 11. No application source, test, Git state, or configuration
  was changed by this validation.
- Reviewed: the generated resource inventory/routes/clients, developer-owned
  item and view hooks, session boundary, Workspace page/component, Scene-table
  entry action, SPA Back link, existing Viewer/stream-key code, focused tests,
  Docker-backed suite, production build, and controlled browser flow.

## Evidence

| Check                                                            | Result                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `yarn api:generate:check`                                        | Passed.                                                                                                                                                                                                                                                       |
| `yarn lint`                                                      | Passed with no warnings/errors.                                                                                                                                                                                                                               |
| Focused Node route test (`scene-workspace.test.ts`)              | Passed: 4 tests. Confirms typed `getSceneItems`/`getSceneViews` parameter mapping, page-size bound, and missing/ambiguous scope rejection before an SDK call.                                                                                                 |
| Focused browser/component tests (`SceneWorkspace`, `SceneTable`) | Passed: 6 tests. Confirms the existing scene-name Viewer action remains intact, the Workspace action is additive, Assembly/View navigation works, and the Back link has SPA `href="/"` semantics.                                                             |
| `yarn build`                                                     | Passed. The authenticated `/scene-workspace/[sceneId]` page and both API routes are included in the production build.                                                                                                                                         |
| Focused Playwright (`e2e/scene-workspace.spec.ts`)               | Passed: auth bootstrap plus Workspace browser flow. It opened Overview → Assembly → Views & states and found no stream-key request or URL value. The first sandbox-only attempt was blocked by port 3100; the same command passed with local-port permission. |
| `yarn test:ci` with Docker/Testcontainers available              | Passed: 27 suites, 162 tests. No regressions in existing Scenes, Viewer, Files, Collections, Parts, Documents, or framework suites.                                                                                                                           |
| `git diff --check 1b7bb24 --`                                    | Passed.                                                                                                                                                                                                                                                       |

## Security and compatibility assessment

- The page uses `defaultServerSideProps`, so direct unauthenticated navigation
  redirects to `/login`; new API routes are wrapped in `withSession` and only
  construct a Vertex client after scope validation.
- Both new route specs expose only `GET`, require one scalar non-empty
  `sceneId`, reject repeated scope values, and cap `pageSize` at 100. They call
  exactly `client.sceneItems.getSceneItems` and
  `client.sceneViews.getSceneViews`; no dynamic proxy or raw-client dispatch was
  introduced.
- The only existing Scene-table change is an opt-in `Open workspace` action.
  The original scene-name action and `View scene` action remain unchanged. No
  Viewer or stream-key source changed.
- The Workspace itself has no stream-key request, storage, SWR key, URL value,
  or rendered key. It is read-only: no hit-coordinate form, Canvas fallback,
  mutation, queue action, or destructive delivery operation is present.

## Findings

### 1. Medium — selected Scene View misleadingly presents scene-wide states as view-specific

**Reproduction**

1. Open the Workspace and choose `Views & states`.
2. Select Scene View A.
3. The component requests `/api/scene-view-states?view=A` and labels the result
   `Saved view states` beneath the selected view.
4. The existing handler resolves View A to its owning scene, then calls
   `sceneViewStates.getSceneViewStates({ id: sceneId, pageSize: 50 })`. The
   installed SDK declares this list endpoint as `Get scene-view-states for a
scene`, with only scene ID, cursor, page size, ID, and supplied-ID filters.
   `SceneViewStateData` has no relationship to a Scene View (only an optional
   Canvas relationship).
5. Therefore states belonging to the scene but not semantically associated with
   View A are displayed as though they were selected-view states. The current
   unit/browser fixtures use a single state and cannot expose this distinction.

This is read-only and does not leak data outside the scene, but it gives a
developer incorrect API semantics while exercising the platform.

**Required repair**

Do not imply an unsupported View → State association. Either present this as a
clearly scene-scoped `Scene saved states` list independent of the selected View,
or defer the state subsection until a verified association contract exists.
Add regression coverage with multiple scene views/states and assert that the
UI wording and request flow retain the actual scene-scoped semantics.

### 2. Medium — missing required Docker/MockServer wire-contract coverage for both new typed routes

Docker is available in this validation environment and the project’s full
Docker-backed suite passes, but no Scene Workspace MockServer test exists.
`scene-workspace.test.ts` mocks the `VertexClient` methods; it cannot establish
the SDK’s actual upstream paths/query serialization or server error mapping.
This is specifically required by handoff 14’s validator instructions when
reviewing on a container-capable runner.

**Required repair**

Add a Docker/Testcontainers MockServer contract suite for both routes. It must
verify the exact upstream request generated by the installed SDK (including the
scene-scoped endpoint path and pagination/filter query parameters), response
cursor handling, and an upstream 4xx/5xx mapping. Keep the existing invalid
scope assertions proving no upstream call occurs.

## Coverage notes

- Existing component and Playwright tests cover the successful Assembly/Views
  flow and secret absence. They do not exercise Workspace loading/empty/403
  states despite the implementation handoff listing those as a validator check.
  The requested MockServer error cases should cover the route boundary; add a
  component/browser error-state assertion as part of the repair.
- The current concurrent Exports/Documents tab is outside the original Scene
  handoff and was not used to establish this acceptance result. It does not
  change the existing Viewer or stream-key UX.

## Verdict

**Rejected — return to Scene Workspace implementation for the two findings.**

The additive/authenticated design, preservation of existing Scene/Viewer UX,
input validation, generated-route ownership, secret boundary, lint, build,
Playwright flow, and full Docker-backed regression suite are all sound. The
slice needs the semantic correction and required raw-SDK contract coverage
before independent revalidation and acceptance.

---

## Final revalidation — 2026-07-21

### Repair assessment

Both findings above are resolved.

1. **Scene-state semantics — resolved.** `SceneWorkspace` no longer requests
   `/api/scene-view-states`, stores a selected state, or presents returned
   scene-wide data as though it belongs to a selected Scene View. The Views &
   states tab now labels the limitation explicitly as `Scene saved states` and
   explains that Vertex lists states by scene, not selected view, so the list
   and its actions are deferred. The user can still select a Scene View for its
   own read-only UI state, while existing Viewer state application/creation is
   untouched. Updated component and browser tests assert the notice and prove
   that no `scene-view-states` request occurs.

2. **Docker/MockServer contracts — resolved.** The new
   `scene-workspace-contract.test.ts` uses the repository's Testcontainers
   harness and real route hooks. Independent execution confirmed:
   - Items serialize `GET /scenes/scene-1/scene-items` with supplied-ID,
     cursor, and page-size query values; returned cursors are preserved and a
     403 maps to the stable dashboard error envelope.
   - Views serialize `GET /scenes/scene-1/scene-views` with cursor/page size;
     returned cursors are preserved and a 500 maps to the stable envelope.
   - A missing views `pageSize` now correctly uses the typed default of 25;
     supplied invalid values remain rejected by the hook. The prior default
     regex rejection is gone.

### Independent revalidation evidence

| Check | Result |
| --- | --- |
| `yarn api:generate:check` | Passed. |
| `yarn lint` | Passed with no warnings/errors. |
| Focused route unit suite | Passed: 4 tests. |
| Focused Docker/MockServer route contracts | Passed: 4 tests with Docker socket access. A sandbox-only attempt cannot access Docker and is not a product failure. |
| Focused Workspace/SceneTable browser suite | Passed: 6 tests. |
| `yarn test:ci` | Passed: 28 suites, 166 tests, including both new Docker contract tests. Expected fixture error logging and an unrelated pre-existing React `act(...)` warning were non-fatal. |
| `yarn build` | Passed. |
| Focused Playwright `e2e/scene-workspace.spec.ts` | Passed: local auth setup plus Workspace flow. It verifies the deferred-state notice, no state/stream-key request, and no stream key in the URL. |
| `git diff --check 1b7bb24 --` | Passed. |

### Final disposition

**Accepted.** The Scene Workspace remains an authenticated, additive,
read-only surface; existing Scene, Viewer, and stream-key UX is unchanged. Its
two typed routes validate scope before client construction, have verified SDK
wire contracts and stable upstream error mapping, and the UI now accurately
defers unavailable Scene View → State semantics without exposing secrets or
adding unsafe mutations.
