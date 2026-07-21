# Scene Workspace implementation handoff

## Scope and compatibility decision

Implemented the verified, highest-value **additive read-only** Scene Workspace
phase. It intentionally leaves all existing scene list, drawer, Viewer,
coordinate-selection, stream-key, merge, view-state creation, and deletion
interactions unchanged.

The new entry point is **Open workspace** in a Scene row's existing actions
menu. It opens `/scene-workspace/:sceneId`, a separate authenticated page with
five progressively disclosed tabs:

1. **Overview** reads the existing `/api/scenes/:id` detail route.
2. **Assembly** lists typed, scene-scoped scene items.
3. **Views & states** lists typed scene views. The workspace explicitly defers
   the scene-wide saved-state list because the SDK does not establish that a
   state belongs to the selected scene view.
4. **Inspect** documents the Viewer-first hit boundary without adding a manual
   coordinate form.
5. **Changes & delivery** records the gated/deferred delivery APIs rather than
   surfacing unsafe or incomplete controls.

No stream key is generated, stored, rendered, logged, put in an SWR key, or
added to the workspace URL. The workspace does not load or alter the Web
Viewer. Existing Viewer behavior—including the legacy shareable URL and local
raycast interaction—is retained exactly as it was, pending the required
security decision for a future in-memory handoff.

## SDK and reference support matrix

Checked on 2026-07-21 against the current [Vertex Platform API reference](https://docs.vertex3d.com/)
and the installed `@vertexvis/api-client-node@0.44.0` declaration file
`node_modules/@vertexvis/api-client-node/dist/cjs/api.d.ts`.

| API family             | Reference/SDK evidence                                                                                                                                                                                                               | Decision in this increment                                                                                                                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scenes                 | SDK: create/delete/get/list/getQueued/update/render. Existing dashboard already implements list/get/create/update/delete/merge.                                                                                                      | Reuse existing detail/list routes only; no change to lifecycle, edit, merge, or delete UX.                                                                                                                                                          |
| Scene items            | SDK: scene-scoped `getSceneItems({ id, pageCursor, pageSize, filterSource, filterSuppliedId, filterParent, filterHasChildren, filterHasGeometrySet, sort })`; create/update return queued jobs; delete has a queued-deletion lookup. | **Delivered:** typed list only through `/api/scene-workspace-items`. Create/update/delete deferred: requires discriminated source, parent/reference-tree cycle, finite transform/material validation, queued polling, and confirmed destructive UX. |
| Scene views            | SDK: create/delete/get/list by scene/get-view-item/render/update.                                                                                                                                                                    | **Delivered:** typed list only through `/api/scene-workspace-views`. Create/update/delete/render deferred: no contextual Viewer/session contract was approved.                                                                                      |
| Scene view states      | SDK: create/delete/get/list/update. Existing route correctly resolves view → owning scene before list/create, but does not establish a state-to-view association.                                                                    | Workspace defers the scene-wide list rather than present it as selected-view data. State application and create remain in the existing Viewer; update/delete confirmation work is deferred.                                                         |
| Stream keys            | SDK: create scene key/delete/list. Reference exposes the sensitive key response.                                                                                                                                                     | Explicitly deferred. New workspace makes no stream-key call because approved one-shot in-memory viewer-session design and legacy URL compatibility/security decision are absent.                                                                    |
| Hits                   | SDK: `createSceneHit` and `createSceneViewHit`; reference requires a 2-D point and viewport dimensions.                                                                                                                              | Explicitly deferred. No coordinate form; an active Viewer event bridge is required.                                                                                                                                                                 |
| Canvases               | The official reference has a Canvases section, but this SDK declaration has Canvas model/relationship types and **no `CanvasesApi` class or callable endpoint methods**.                                                             | Explicitly unavailable; no raw Axios/proxy fallback or empty resource table. Upgrade and contract decision required.                                                                                                                                |
| Model views            | SDK: get detail and paged lists by part revision or scene item. Existing Viewer uses a viewer-SDK paging/load/unload bridge.                                                                                                         | Existing Viewer behavior untouched; server adapters deferred until durable detail adds value.                                                                                                                                                       |
| PMI                    | SDK: `PmiApi.getPmiAnnotations`; reference marks PMI as requiring Engage.                                                                                                                                                            | Existing Viewer PMI panel untouched; module/403 capability presentation is deferred with a future Viewer-linked inspector.                                                                                                                          |
| Scene alterations      | SDK: create → queued, get queued/detail/list.                                                                                                                                                                                        | Deferred: scene-view context, operation preview, polling, and permissions have not been validated.                                                                                                                                                  |
| Scene annotations      | SDK: create annotation/set, delete, list sets, update.                                                                                                                                                                               | Deferred: anchor/context and Engage/preview risk need a separate decision.                                                                                                                                                                          |
| Scene item overrides   | SDK: create/delete/list/update.                                                                                                                                                                                                      | Deferred: typed transform/material/visibility controls plus preview/confirmation are required.                                                                                                                                                      |
| Scene synchronizations | SDK: create → queued, get queued/detail/item results; no general list.                                                                                                                                                               | Deferred: no unbacked list; must show explicit returned IDs/status and contextual confirmation.                                                                                                                                                     |
| Batches                | SDK/reference: create → queued batch; get queued can redirect to terminal batch; complex closed operations.                                                                                                                          | Deferred: requires a proven narrow scene-item operation, diff/count preview, confirmation, and bounded polling.                                                                                                                                     |

## Files intentionally changed

- `api-resources.json` adds generator inventory entries for the two conventional
  read routes.
- Generated, checked-in clients/routes:
  - `src/lib/resources/scene-workspace/scene-workspace-items.client.ts`
  - `src/lib/resources/scene-workspace/scene-workspace-views.client.ts`
  - `src/pages/api/scene-workspace-items.ts`
  - `src/pages/api/scene-workspace-views.ts`
- Developer-owned typed lifecycle/SDK hooks:
  - `src/lib/resources/scene-workspace/scene-workspace-items.hooks.ts`
  - `src/lib/resources/scene-workspace/scene-workspace-views.hooks.ts`
    Both require one scalar `sceneId`, reject ambiguous query values, bound page
    size to 100, and invoke only their respective typed SDK list method.
- UI and entry point:
  - `src/components/scene/SceneWorkspace.tsx`
  - `src/pages/scene-workspace/[sceneId].tsx`
  - `src/components/scene/SceneTable.tsx` (additive menu action only)
- Coverage:
  - `src/__tests__/pages/api/scene-workspace.test.ts`
  - `src/__tests__/pages/api/scene-workspace-contract.test.ts`
  - `src/__tests__/components/scene/SceneWorkspace.test.tsx`
  - `src/__tests__/components/scene/SceneTable.test.tsx`
  - `e2e/scene-workspace.spec.ts`

## UX and security compatibility evidence

- Existing SceneTable viewer-name action is covered unchanged by
  `opens the scene viewer when the scene name is clicked`.
- The new `offers the additive workspace without changing the existing viewer
action` test proves the new action separately routes to
  `/scene-workspace/scene-1`.
- The workspace component and Playwright tests select Assembly and a View,
  verify the explicit scene-wide-state deferral notice and the absence of a
  scene-view-states request, and assert no request/URL contains `stream-key`
  or `streamKey`.
- No existing scene/viewer files were changed. The sole existing component
  modification is the extra opt-in Scene row menu entry.

## Commands run

| Command                           | Result                                                                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `yarn api:generate:check`         | Passed.                                                                                                                                     |
| `yarn lint`                       | Passed with no warnings/errors.                                                                                                             |
| Focused Node route suite          | Passed: 4 tests. Covers typed parameter mapping, max page bound, missing/ambiguous scope rejection, zero SDK operation on rejected input.   |
| Focused browser/component suite   | Passed: 6 tests. Covers workspace Assembly/Views/states and existing viewer plus additive workspace entry behavior.                         |
| Docker/MockServer route contracts | Passed: 4 tests. Verifies exact SDK path/query serialization, cursor response mapping, and 403/500 stable errors for scene items and views. |
| `yarn build`                      | Passed.                                                                                                                                     |
| `yarn test:e2e`                   | Passed: 5 Playwright tests after local port permission. New controlled fixture flow verifies actual workspace UI and secret absence.        |
| `git diff --check`                | Passed at implementation review time. Rerun after any concurrent work before handoff.                                                       |

The first sandbox Playwright attempt failed to bind `0.0.0.0:3100` with
`EPERM`; the identical command passed with the permitted local-port execution.

## Validator instructions

1. Check `yarn api:generate:check` before review. Generated client/route files
   must remain generator-owned; custom list semantics belong only in the two
   hooks.
2. Confirm `GET /api/scene-workspace-items` accepts a single non-empty
   `sceneId`, forwards only the declared scene item list parameters, clamps
   page size, and cannot dynamically dispatch a resource/method. Do the same
   for scene views. `scene-workspace-contract.test.ts` is the Docker/MockServer
   serialization check and must verify upstream path/query/cursor/error mapping.
3. Verify the new workspace does not request `/api/stream-keys`, render a key,
   include a key in its URL, storage, SWR keys, snackbar, or console.
4. Confirm the old scene-name and `View scene` interaction remains unchanged;
   the new workspace action must be additive, not a replacement.
5. Exercise the real controlled browser page: Overview → Assembly → Views &
   states → select view. Verify the scene-wide-state deferral notice appears
   and no `scene-view-states` request is made. Verify loading, empty/error,
   and a 403 response leave the page navigable. The delivered UI is
   intentionally read-only.
6. Reject any expansion that adds a generic proxy, a raw JSON editor, manual
   hit dimensions/coordinates, unapproved stream-key URL behavior, Canvas
   methods not in the installed SDK, mutation without queued-job handling, or
   destructive delivery action without preview/confirmation.

## Follow-up prerequisites

Before the next Scene phase: obtain an explicit security decision for legacy
viewer URLs and a new one-shot in-memory viewer handoff; then implement a
mocked Viewer readiness/selection bridge before Hits or state application.
Canvas requires a tested SDK upgrade decision. Any mutation phase needs typed
payload validators, queued terminal handling, capability/403 behavior, canonical
refresh, and its own validation loop.

## Follow-up — SPA navigation

The workspace header's visually unchanged outlined **Back to scenes** control
now uses `next/link` as the Button component, rather than a plain `href`. This
preserves the accessible link semantics and client-side navigation while keeping
the existing appearance. The focused workspace component test now asserts the
link's accessible name and `/` target.

- `yarn test --selectProjects browser --runInBand src/__tests__/components/scene/SceneWorkspace.test.tsx`: passed.
- `git diff --check -- src/components/scene/SceneWorkspace.tsx src/__tests__/components/scene/SceneWorkspace.test.tsx`: passed.
- A subsequent repository-wide `yarn lint` could not complete because concurrent
  Exports/Documents work added `src/lib/artifacts.ts` containing a literal
  control character in a regular expression (ESLint `no-control-regex`, line
  123). This Scene-only follow-up adds no lint errors; rerun the full lint gate
  after that concurrent change is repaired.

## Rework after adversarial validation (handoff 19)

The validator correctly found that the first implementation read
`/api/scene-view-states?view=<selected-view>` and displayed its scene-wide
result as selected-view data. That read and selected-state UI have been removed
from the workspace. The Views tab now labels the limitation plainly and directs
state application/creation to the unchanged Viewer. This preserves the Viewer
UX and avoids asserting an association the API does not provide.

Added `scene-workspace-contract.test.ts`, using the repository's Docker
MockServer harness and real generated route hooks. It asserts the SDK makes
these exact calls:

- `GET /scenes/scene-1/scene-items` with `filter[suppliedId]=assembly-1`,
  `page[cursor]=cursor-1`, and `page[size]=100`.
- `GET /scenes/scene-1/scene-views` with `page[cursor]=cursor-1` and
  `page[size]=100`.

It also verifies returned cursors and stable 403/500 error envelopes. While
adding the contract coverage, it exposed a default-page-size bug in the views
hook: a missing `pageSize` defaulted to 25 but was then rejected by the
supplied-value validation regex. The hook now accepts the default while
retaining strict validation for supplied values.

- `yarn test --selectProjects node --runInBand src/__tests__/pages/api/scene-workspace-contract.test.ts`: passed (4 tests).
- `yarn test --runInBand`: passed (28 suites, 166 tests).
- `yarn test:e2e`: passed (7 Playwright tests).
- `yarn api:generate:check`, `yarn lint`, `yarn build`, and `git diff --check`: passed after regeneration.
