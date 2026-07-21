# Scene Workspace — engineering plan

## Delivery gate and scope boundary

This is the implementation plan for the Scene composition/delivery group. It is
**not authorized to start** until the Core import/library PR has completed its
independent validation loop, including its Docker/MockServer CI gate and the
controlled-browser checks in `03-validation-plan.md`. The Scene PR must be a
draft stacked on that accepted Core commit. Do not add Scene manifest entries,
routes, viewer controls, or shared-component changes before then.

The intended product is a scene-specific developer workspace: inspect a known
scene, compose it from typed source assets, view it safely, and manage saved
view state and confirmed delivery operations. It is not a generic API explorer,
not a replacement for Vertex Connect, and not permission to surface every
documented scene endpoint.

The browser continues to call same-origin Next Pages Router endpoints only.
`withSession` and `getClientFromSession` remain the sole OAuth/client-secret
boundary. The Web Viewer may receive a stream key, but React must not receive an
OAuth bearer token or client secret. Do not introduce root `middleware.ts`.

## Current foundation and contracts to preserve

| Area                        | Reuse                                                                                                                                                                                                                                                        | Preserve while migrating                                                                                                                                                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scene discovery             | `src/pages/index.tsx`, `components/scene/SceneTable.tsx`, `SceneDrawer.tsx`, `src/lib/scenes.ts`, `pages/api/scenes.ts`, and `pages/api/scenes/[id].ts`.                                                                                                     | `/api/scenes` remains the cursor-paged/filterable list with `{ status, cursors, data }`; it keeps name/supplied-ID filters, raw JSON:API sparse-field/query fallback, scene state display, details/edit selection, merge, and the current direct-handler seam. |
| Scene workflows             | `components/shared/CreateSceneDialog.tsx`, `pages/api/merged-scenes.ts`, and the existing create/update/delete branches in `pages/api/scenes.ts`.                                                                                                            | Source-to-scene and merge orchestration remain explicit developer-owned workflows. The create-scene route currently creates a scene, creates an item, then commits; do not flatten that into a generated CRUD call or imply synchronous completion.            |
| Viewer runtime              | `pages/scene-viewer/[sceneId].tsx`, `components/viewer/Viewer.tsx`, `LeftDrawer.tsx`, `RightDrawer.tsx`, `SceneTree*.tsx`, `ViewerContextMenu.tsx`, and `src/lib/viewer.ts`.                                                                                 | Existing Viewer/scene-tree custom elements, custom network configuration, readiness sequencing, listener cleanup, and local selection/visibility/fit actions remain intact. The local Web SDK raycast is UI feedback, not a Platform Hit API call.             |
| Viewer state/inspection     | `src/lib/scene-items.ts`, `model-views.ts`, `metadata.ts`; `MetadataProperties.tsx`, `ModelViews.tsx`, `PmiAnnotations.tsx`, `SceneViewStateList.tsx`, and `CreateSceneViewStateDialog.tsx`.                                                                 | Selected item → metadata/model-view/PMI behavior stays lazy. Preserve the existing relationship-aware server operation that resolves a scene from a `sceneViewId` before listing/creating a view state.                                                        |
| Existing API actions        | `pages/api/scene-items/[id].ts`, `scene-view-states.ts`, and `stream-keys.ts`.                                                                                                                                                                               | Keep their route paths and response shapes until generated replacements have equivalent direct-handler and browser coverage. Stream keys remain short-lived, one-shot action results—not ordinary resource list data.                                          |
| Shared platform conventions | Accepted framework files in `src/lib/api/`; `src/lib/api.ts`, `paging.ts`, `query-filters.ts`, `query-params.ts`, `sorting.ts`; MUI `Layout`, `TableHead`, `TableToolbar`, `RowActionsMenu`, `DataLoadError`, `SkeletonBody`, `ResourceLink`, `VectorTable`. | Keep public `Res`/`ErrorRes`/`GetRes` shapes, deterministic SWR key ordering, validated route lifecycle, error normalization, and current accessibility labels. Do not modify the global SWR fetcher in `_app.tsx`.                                            |

The current direct viewer route exposes the stream key in its query string via
`encodeCreds`, and `SceneTable` includes the key in clipboard success text. That
is an existing compatibility/security risk, not a pattern to extend. Before any
new workspace route renders the viewer, complete the stream-key security decision
below; tests must prove the chosen path does not introduce a new URL, SWR,
local-storage, DOM, log, or analytics exposure.

## 0.44.0 SDK reconnaissance and pre-implementation matrix

The declarations are currently installed at
`node_modules/@vertexvis/api-client-node/dist/cjs/api.d.ts`; this is a planning
snapshot, not a substitute for rechecking current official docs immediately
before implementation. The following typed SDK surface was observed:

| Domain                 | Typed support observed                                                                                           | Scope consequence                                                                                                                        |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Scenes                 | `getScenes`, `getScene`, `createScene`, `updateScene`, `deleteScene`, `getQueuedScene`, render.                  | Phase A parity/migration is supported; lifecycle transition validation remains a custom UX decision.                                     |
| Scene items            | list/get/create/update/delete plus queued-create/queued-delete reads. Create/update return queued jobs.          | Phase A can offer one typed source/item workflow with status polling; arbitrary payload edits are out.                                   |
| Scene views            | list/get/create/update/delete, get view-scene-item, render.                                                      | Phase A supports a scene-contextual Views panel after request fields/relationships are documented.                                       |
| Scene view states      | list/get/create/update/delete.                                                                                   | Phase A supports selected view → resolved scene → states with explicit replace/delete confirmation.                                      |
| Stream keys            | create/delete/get are declared.                                                                                  | Do not surface key listing by default despite SDK support; sensitive key policy wins.                                                    |
| Hits                   | create hit for a scene or scene view.                                                                            | Phase B only; handler inputs must come from viewer gesture/viewport mapping.                                                             |
| Model views / PMI      | Model-view get plus paged lists by part revision/scene item; PMI annotation list.                                | Phase B read/inspection is supported; retain Viewer SDK bridge where it better represents loaded state. PMI capability denial is normal. |
| Canvases               | Canvas data types exist, but no `CanvasesApi` class was present in the installed declaration.                    | Deferred. No raw Axios fallback or UI route until an SDK upgrade/official supported client decision is accepted separately.              |
| Scene alterations      | create, list/get for scene view, queued-alteration get.                                                          | Phase C starts only with read/list/detail plus a narrow, typed queued-action follow-up; no generic editor.                               |
| Scene annotations      | annotation-set list; annotation/set create, update, delete. The create/update/delete methods are marked preview. | Show only a capability/preview-gated inspection entry after docs contract verification; defer mutation by default.                       |
| Item overrides         | list/create/update/delete for a scene view.                                                                      | Phase C read/context inspection first; mutations need a typed preview/confirmation editor.                                               |
| Scene synchronizations | create, get queued job, get sync, get sync item results; no general list method was observed.                    | No browse table. Show direct-ID results only once a creation/result workflow provides the ID.                                            |
| Batches                | create, get queued batch, get batch. No list.                                                                    | Phase D advanced, direct-result workflow only; queued response may redirect at completion.                                               |

Before adding any endpoint, the implementor must append a docs-to-SDK matrix to
the implementation handoff. For every operation it must record exact current
reference/Postman path and source date, SDK class/method, request and response
type, path/query/body/relationship requirements, sparse fields/includes,
permissions/preview/module constraints, asynchronous/redirect/terminal behavior,
and the screen/control that uses it. Use the actual declarations, for example:

```sh
rg -n '^export declare class (ScenesApi|SceneItemsApi|SceneViewsApi|SceneViewStatesApi|StreamKeysApi|HitsApi|ModelViewsApi|PmiApi|SceneAlterationsApi|SceneAnnotationsApi|SceneItemOverridesApi|SceneSynchronizationsApi|BatchesApi)' node_modules/@vertexvis/api-client-node/dist/cjs/api.d.ts
rg -n 'create(SceneItem|SceneView|SceneViewState|SceneHit|SceneViewHit|Batch)|getQueued(SceneItem|SceneItemDeletion|SceneAlteration|SceneSync|Batch)' node_modules/@vertexvis/api-client-node/dist/cjs/api.d.ts
rg -n 'CanvasesApi|class Canvas' node_modules/@vertexvis/api-client-node/dist/cjs/api.d.ts
```

Classify each row as **supported and typed**, **typed but needs product/docs
research**, **preview/module-gated**, or **absent from 0.44.0**. An absent
operation requires a separate SDK-upgrade decision/PR; never substitute an
untyped generic Axios proxy. The two existing reviewed raw list-query fallbacks
(scenes/files/collections where applicable) do not authorize new ones.

## Staged implementation scope

### Phase 0 — prerequisite and workspace shell

After Core validation, migrate the existing Scenes resource only after preserving
route parity. Add a scene-specific workspace shell—prefer
`/scene-workspace/[sceneId]` over changing the existing `/scene-viewer/[sceneId]`
contract—with an authenticated server-side scene lookup/404 handling patterned on
`file-collections/[fileCollectionId].tsx`. Keep the legacy viewer URL working
until the stream-key security review explicitly approves a compatibility plan.

The shell owns the selected scene, selected item, selected view, selected view
state, operation status, and a five-panel navigation model (Overview, Assembly,
Views & states, Inspect, Changes & delivery). It must not fetch/render every
panel before it has the relevant scene/view/item context.

### Phase A — safe scene composition and delivery baseline

Implement only typed and context-complete operations:

1. **Scenes:** retain list/get/create/update/delete/merge. Add framework parity
   validation, structured name/supplied-ID/metadata editing, explicit update
   result/error feedback, and a read-only lifecycle summary. Do not expose a
   lifecycle state selector until legal transitions and queued behavior are
   confirmed in the matrix.
2. **Scene items:** add scene-scoped list/get in the Assembly panel; add at most
   one narrow create/update/delete workflow after source, parent and reference
   tree types are verified. A source picker must distinguish part revision,
   part rendition, geometry set, and scene. Creation/update returns queued work;
   poll only until terminal then refresh item list, selected item, and scene
   details/count. A failed/deleted selected item clears safely with an error.
3. **Scene views and view states:** add a scene-scoped View picker, then list/get
   states for the selected view using the existing view-to-scene resolution rule.
   Preserve the existing Create View State action from the actual loaded Viewer
   scene view. Update/delete is added only after request semantics are verified;
   applying a state remains a Viewer action and does not imply persistence.
4. **Stream keys:** add a workspace action only after the security decision. Use
   a server-side, typed expiry allowlist. Return the key to the requesting
   viewer handoff only; do not list it, cache it, show it in a snackbar, or put
   it in the new workspace URL. Keep key revocation/listing out of this phase
   unless security/product review explicitly needs it.

### Phase B — viewer-led inspection

Implement after scene/view identity is reliable:

- **Hits:** convert a Viewer tap event into a typed local action request with
  the rendered viewport size, 2D position, scene or active scene-view target,
  and an allowlisted optional field/include set. The hook selects
  `createSceneHit` or `createSceneViewHit`; it never accepts client-provided
  arbitrary endpoint/coordinate/field data. Display the Platform result next to
  the existing local raycast selection and preserve a viewer-not-ready state.
- **Model views/PMI:** retain `useModelViews` pagination/load/unload because it
  represents Viewer state. Add server detail/list adapters only where useful
  for durable resource detail. Keep item/model-view identity synchronized and
  provide loading, empty, network error, 403, and Engage-unavailable states.
- **Canvases:** remain unavailable in this release; display no empty canvas
  resource table. A future SDK upgrade decision may enable a contextual panel.

### Phase C — contextual changes/delivery, read-first

- **Alterations:** scene-view-scoped list/get and queued status only. If a
  narrow mutation is accepted, support one typed operation with a computed
  affected-item/field preview, confirmation, queued polling and refresh. No raw
  alteration-expression editor.
- **Annotations:** list scene annotation sets only when the documented
  relationships make a useful inspector possible. Preview/missing-capability is
  explicitly labeled. Do not expose create/update/delete in this group without
  a separate preview-risk decision.
- **Item overrides:** list by current scene view and inspect selected item
  relationship. Mutation needs structured material/visibility/transform inputs,
  preview and confirmation; defer by default.
- **Synchronizations:** do not create an unbacked list—SDK offers direct get and
  result endpoints, not a general list. If a reviewed typed create flow is
  added, show its returned ID/status/results in the workspace activity card and
  poll only while queued.

### Phase D — batches (advanced and last)

Use `BatchesApi.createBatch`, `getQueuedBatch`, and `getBatch` only after one
safe repeated scene-item operation is proven outside batching. The builder must
use a closed operation allowlist and typed relationships; render human-readable
diff/count/target scene before explicit confirmation. Store the queued batch ID
as operation state, handle `running`/`error` and completion redirect/result,
refresh canonical scene data, and provide no automatic retry. Do not treat batch
as generic bulk deletion.

## Developer-owned lifecycle overrides

The accepted route framework handles method dispatch, session client creation,
safe parsing, validation lifecycle, error mapping, and standard adapters. Keep
the following behavior in Scene developer-owned hooks/custom action modules;
never add resource-specific branches to `createVertexRoute`.

| Operation                       | Required custom behavior                                                                                                                                                                                                                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Scene list/detail/update        | Preserve current raw list filter/sparse-field mapper and allowed fields; parse/validate structured metadata/camera values; lifecycle transition guard; partial-delete outcome mapper and scene-list invalidation. Retire `SceneDrawer`'s opaque metadata JSON only when typed metadata editor parity exists. |
| Create/merge scene              | Multi-step orchestration (create scene → typed scene items → commit/camera). Validate non-empty sources and aggregate individual failures; expose queued IDs/status rather than success before terminal completion.                                                                                          |
| Scene item create/update/delete | Discriminated source relationship mapper, parent/reference-tree validation (including no self/known cycle), finite vector/transform/material validation, queued result normalization, selected-item invalidation and refresh fan-out.                                                                        |
| Views/states                    | Context resolver (`sceneViewId` → owning scene) is server-side; Viewer readiness/capture mapper for create; selected-state apply bridge; view/state/list/detail invalidations. Replace/delete confirmation states exact consumer-visible scope.                                                              |
| Stream key/viewer session       | Expiry bounds, one-shot redaction, memory-only handoff, copy/open behavior and failure feedback. Security review must decide direct legacy URL handling; new workspace must not silently recreate it.                                                                                                        |
| Hit/Inspect                     | Viewer event → normalized dimensions/point → explicit scene vs scene-view method selector; optional field/include allowlist; abort/revision guard for stale selections; result/selected-item bridge.                                                                                                         |
| Model view/PMI                  | Viewer SDK paging bridge, `hasAnnotations` policy, load/unload synchronization, and typed capability error mapper. A 403/module-unavailable is a stable read-only UI state, not a fallback to an unrelated API.                                                                                              |
| Alteration/override/annotation  | Selected scene/view/item binding, typed payload mapper, diff/affected-resource preview, preview/module capability guard, and contextual invalidations.                                                                                                                                                       |
| Sync/batch/queued operations    | Closed operation builder, preflight authorization/context checks, normalized queued-job/redirect terminal mapper, bounded polling/cancellation, canonical refresh after terminal result, no implicit retry. Reuse Core's accepted async-status contract if it exists.                                        |

## UI state, viewer bridge, and shared extraction

First reuse the Core-accepted `ConfirmDestructiveAction`, `RelationshipPicker`,
`ResourceStatusChip`, `DetailsSection`, and async job-status component **only if
they are actually accepted with stable interfaces**. Do not fork equivalents in
the scene branch while Core is unresolved.

New Scene-only abstractions are justified only where the same state crosses at
least three Scene surfaces:

| Candidate                                                | Consumers                                                                        | Contract / restriction                                                                                                                                                                                                         |
| -------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `useSceneWorkspaceSelection` (Scene-only hook)           | Viewer tap, scene tree row, assembly table/detail, hit/model-view panels.        | One normalized selected `sceneId`/`sceneItemId`/`sceneViewId`/`sceneViewStateId` state with origin/revision/clear actions. It synchronizes selection requests but does not own API payloads, stream keys, or Viewer rendering. |
| `ViewerReadinessGate` (Scene-only presentation boundary) | Viewer toolbar actions, state capture/apply, Hit inspect, Assembly tree actions. | Supplies explicit `loading`, `not-ready`, `expired/error`, and ready slots; avoids calling a viewer ref before custom elements/scene view are ready. Do not hide permission/API errors as readiness failures.                  |
| Workspace activity panel using Core async status         | Scene item queue, alteration queue, synchronization queue, batch queue.          | Reuse the Core component/normalizer rather than adding a separate generic polling system. Each caller declares terminal statuses and refresh targets.                                                                          |
| `CapabilityNotice`                                       | PMI Engage, annotation preview, unavailable Canvas, mutation 403.                | Extract only if the first three have identical read-only/fallback semantics. It accepts a feature label/status/help text; it does not make policy decisions.                                                                   |

Keep `VectorTable` for display. Do not extract generic transform/color/camera
editors until three verified forms have the same typed shape; scene item
transforms, scene camera, and override material inputs have materially different
validation and should begin domain-local.

## Stream-key security decision (blocking Phase A workspace Viewer)

Before implementation, record an approved decision with a security reviewer:

1. For a new workspace, preferred behavior is an authenticated same-origin
   one-shot viewer-session action that returns the stream key directly to
   in-memory React state. The Viewer receives it but it never enters a route,
   URL, local/session storage, SWR key/cache, activity payload, snackbar, or
   console message.
2. The legacy `/scene-viewer/[sceneId]?clientId=...&streamKey=...` route needs
   a compatibility assessment. Preserve it unchanged only with explicitly
   accepted risk/mitigations; otherwise plan a migration/redirect that does not
   break supported shared links unexpectedly.
3. Validate expiry bounds from docs/SDK and clear the in-memory key on unmount,
   scene change, viewer reset/expiry or explicit close. Do not make a second
   key automatically after a failure without user action.

This decision is required before a Scene workspace implementation can call the
Viewer. It is not satisfied by hiding the key visually while retaining it in a
URL or toast string.

## Targeted validation gates

Follow `03-validation-plan.md` in full. Add the following focused evidence as
each phase lands.

| Layer                                 | Required checks                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SDK/docs matrix                       | Declaration and current-doc operation matrix checked into the implementation handoff; each deferred resource explains whether it is absent, preview/module-gated, unsafe, or lacking a contextual UX.                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Route/framework Jest (node)           | Exact method/path/query/body/relationship mapping for scenes, item source/parent mapping, view→scene resolution, state create/update/delete, expiry validation, hit target selection, queued result/redirect/error normalization, and blocked unknown/invalid input with zero upstream calls. Use MockServer contract tests for supported upstream calls on Docker-capable CI.                                                                                                                                                                                                                                                       |
| Pure hook tests                       | Finite vector/material/metadata validation; source discriminant and parent-cycle rejection; lifecycle transition guard; payload allowlists; terminal-status/poll cancellation; selected-resource invalidation map; stream-key redaction helper; stale selection abort/revision behavior.                                                                                                                                                                                                                                                                                                                                             |
| Component/MSW Jest                    | Scene list parity; workspace panel gating; tree/table/viewer selection synchronization; selected item deleted/not-found; empty/loading/error/403 capability states; view state create/apply/delete confirmation; operation activity updates; no key rendered in title/toast/details; preview/diff confirmation for destructive advanced work. Mock the Viewer adapter/custom elements rather than calling a Vertex host.                                                                                                                                                                                                             |
| Existing Viewer unit seams            | Cover `useSceneWorkspaceSelection` and `ViewerReadinessGate` with a mocked viewer ref; retain tests for `selectByHit`, state apply, model-view paging/load/unload, and listener cleanup. A local viewer raycast must not be asserted as a Platform hit request.                                                                                                                                                                                                                                                                                                                                                                      |
| Browser/Playwright controlled backend | Extend the accepted local e2e session harness. Intercept only same-origin scene/workspace API fixtures; do not contact Vertex. Smoke: filter/select a scene → open workspace → select item through mocked viewer/tree → inspect details → create/apply a state → run one confirmed typed item change and see queued→terminal refresh. After Phase B, dispatch a fixture viewer gesture and assert the local Hit action body contains derived dimensions/position. After Phase D, add confirmation → queued batch → terminal result. Assert URL/DOM/storage do not contain `streamKey`; ensure 403/PMI unavailable remains navigable. |
| Build/release                         | `yarn format` (review diff), `yarn lint`, `yarn test:ci`, `yarn api:generate:check`, `yarn test:e2e`, and `yarn build`. Docker/Testcontainers and port/binary limitations are recorded as not-run and rerun in a capable CI runner; they are never reported as pass.                                                                                                                                                                                                                                                                                                                                                                 |

The Playwright fixture validates the actual dashboard UI and local route request
shape. It does not prove a third-party Viewer/Platform render against a real
tenant. Any optional live smoke must use an approved disposable non-production
scene/account and report that scope separately; never use shared production
data for destructive item/batch/synchronization tests.

## Implementor handoff checklist

- Core validation acceptance/commit and the accepted Core shared-component APIs.
- Current docs-to-SDK matrix, including the explicit Canvas absence and all
  preview/module/async decisions.
- Approved stream-key security/legacy-route decision before a workspace viewer
  change.
- Exact manifest entries and developer-owned lifecycle/action hooks; retained
  route contracts and direct-handler test seams.
- Phase-specific fixture data, relationship IDs, queued state sequence, and
  invalidation map.
- Completed focused test evidence and validation template before independent
  review.

If any prerequisite is missing, return this group to research/planning rather
than approximating an endpoint, exposing an opaque JSON editor, or broadening
the framework.
