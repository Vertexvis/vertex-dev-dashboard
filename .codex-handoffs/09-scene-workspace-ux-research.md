# Scene composition and delivery — UX research handoff

## Goal and boundary

Build a developer-focused **Scene Workspace** that lets a user inspect a scene, safely compose it from known source assets, validate the result in the existing Web Viewer, and manage reproducible scene/view state. It should make API relationships and operation state legible—not become a low-level JSON request console or replace Vertex Connect.

In scope from the [current official Vertex Platform API reference](https://docs.vertex3d.com/): `scenes`, `scene-items`, `scene-views`, `scene-view-states`, `stream-keys`, `hits`, `canvases`, `model-views`, `pmi`, `scene-alterations`, `scene-annotations`, `scene-item-overrides`, `scene-synchronizations`, and `batches`. The current dashboard SDK pin remains `@vertexvis/api-client-node@0.44.0`; dependencies are not installed in this worktree. Before implementation, install it and record a **docs-to-SDK operation matrix**. Do not fabricate a generic Axios fallback for documented operations absent from this SDK; decide on a separately tested upgrade first.

The API reference establishes two especially important constraints:

- A batch is asynchronous: creation returns a queued batch, whose terminal completion resolves to a batch; it is appropriate for grouped scene-item changes only after the basic workflow is solid.
- Hits are create actions against either a scene or scene view and require viewport dimensions plus a 2D point; they should be fed by viewer interaction rather than a manual coordinate form.
- PMI docs identify it as an Engage Module capability. Treat feature/permission unavailability as a supported state, not an error that breaks the workspace.

## Existing foundation to preserve

- **Scenes index:** `/` has server-paged/filterable scene rows, state chips, bulk deletion, details/edit drawer, merge flow, stream-key generation, and viewer navigation (`SceneTable`, `SceneDrawer`, `pages/api/scenes*`, `merged-scenes.ts`). It already uses local API routes and `withSession`/`getClientFromSession` as the credential boundary.
- **Viewer:** `/scene-viewer/[sceneId]` has a Web Viewer, assembly tree, item selection/visibility/fit controls, metadata details, model-view/PMI panels, view-state list/create, base-camera update, and client-side raycast selection. The viewer derives `sceneViewId` when ready and lazy-loads a selected scene item.
- **Reusable UI:** `Layout`, `RightDrawer`, `TableToolbar`, `RowActionsMenu`, cursor pagination, `DataLoadError`, `SkeletonBody`, `ResourceLink`, `VectorTable`, typed JSON metadata display, and the core group’s proposed `ConfirmDestructiveAction`, `RelationshipPicker`, and `AsyncJobStatusCard` should be reused.
- **Existing routes are intentionally partial:** scenes have list/get/create/update/delete, scene items get only, scene-view states list/create only (via a source scene view), and stream keys are create only. This group must preserve existing response envelopes while migrations are proven.

## Product shape: one workspace with progressive disclosure

Selecting **Open workspace** from a Scene row should open a scene-specific page (or evolve the existing viewer route) with a persistent scene header—name, supplied ID, lifecycle state, item count, last modification, copy ID, and explicit actions—and five tabs/panels:

1. **Overview** — Scene metadata, camera/world orientation/tree setting, lifecycle/operation status, and safe edit controls. Show a compact activity/result area for commits, item mutations, synchronization and queued batches.
2. **Assembly** — Existing viewer tree plus a table/detail inspector for scene items. Selecting an item synchronizes tree, viewer selection, metadata, source/parent/reference-tree links, visibility/material/transform summary, and relevant model views.
3. **Views & states** — Scene views and view states with a selected state applied in the viewer. A view-state card shows name/IDs/source/timestamps and actions available from the verified API. Create state from the current viewer view; use a confirmation for replace/delete because a saved state changes what others may consume.
4. **Inspect** — Viewer-first click inspection: hit result, item metadata, model views, PMI annotations, and canvases. These are query/diagnostic facilities; avoid presenting a blank resource table before a scene/item/view context exists.
5. **Changes & delivery** — Advanced, collapsible panel for alterations, annotations, item overrides, synchronizations, and batches. Each action should be typed, previewable and contextual to selected scene/item; default it to read/inspect until the corresponding operation and permission matrix is verified.

The Scene list remains the quick discovery/management surface. The workspace owns relationships and viewer-specific state so a user never must manually paste a scene ID between pages.

## Prioritized phases

### Phase A — Complete the safe scene workflow

Prioritize `scenes`, `scene-items`, `scene-views`, `scene-view-states`, and `stream-keys`.

- **Scenes:** preserve list/get/create/update/delete and merge. Improve update feedback and validation; use structured fields for name/supplied ID/metadata, a camera preview/copy action, and a deliberate lifecycle control only after valid state transitions are confirmed. Do not surface raw camera matrix JSON in the normal edit form.
- **Scene items:** list/get/create/update/delete only to the extent confirmed by SDK/docs. Create with a source picker that restricts choices to compatible part revisions, part renditions, geometry sets, or scenes; parent/reference-tree relationships are selectable from the current assembly. Render transform, visibility, material and metadata as structured controls/summary, not a single opaque payload. Every mutation refreshes the assembly and scene item count.
- **Scene views/states:** list/get/create/update/delete only as confirmed. The existing state create route resolves the containing scene from a selected scene view—retain that relationship-aware behavior. The workspace should select an existing scene view first, then create/apply/list its states; it should not infer a durable view ID from an arbitrary viewer event.
- **Stream keys:** retain generate/copy/open-viewer as a one-shot action. Default expiry should be explicit and constrained to API limits; never list previous keys because the response is sensitive and not retrievable by design.

Success path: choose a translated source, create/compose a scene, observe its lifecycle, open it, inspect an item, save/apply a view state, and generate a short-lived key for that scene.

### Phase B — Viewer-led inspection

Prioritize `hits`, `canvases`, `model-views`, and `pmi` after Phase A’s scene/view identity is reliable.

- **Hits:** a viewer click populates an Inspect card with selected item ID, supplied ID, hit point/normal and returned relationship data. The custom handler derives x/y and viewport width/height from the actual viewer, chooses the correct scene-versus-scene-view endpoint, and requests only explicitly selected optional fields. Keep the current client raycast selection as UX feedback, but do not mistake it for the Platform hit API.
- **Model views/PMI:** retain the lazy, paged viewer SDK experience for model views and annotations, add stable empty/loading/error states, has-annotations filtering when supported, and link the selected item/model-view identity to the server API detail route. PMI functionality must show a clear “not enabled/not authorized” state where Engage capability is absent.
- **Canvases:** add only the verified list/get/create/action subset as a Scene View–contextual diagnostic panel. Its creation/interaction should take dimensions/coordinates from the viewer—not a free-form modal—if the docs/SDK require viewport input.

### Phase C — Persisted scene changes and synchronization

Add `scene-alterations`, `scene-annotations`, `scene-item-overrides`, and `scene-synchronizations` as contextual resources. Start read-first: list/get and detail/relationship inspection. Then allow only operations whose typed request contracts and effects are documented in the installed client.

- **Alterations/overrides:** show a diff/summary against the selected item/scene and a preview of affected item IDs/fields before confirmation. Material/color, transform, visibility and source metadata selection need typed editors with range/shape validation.
- **Annotations:** display them in the viewer and in an accessible list with author/time/context. A creation UI must clearly identify its scene/view/item anchor and avoid treating it as PMI data.
- **Synchronizations:** show source/target/status/last run and job/error feedback. Put creation/retry behind explicit confirmation because synchronization can alter downstream data; never promise immediate consistency.

### Phase D — Batch operations (advanced)

`batches` is an explicit advanced tool, not a normal bulk-delete replacement. Build a structured operation builder from selected scene items, display a human-readable diff, require confirmation, submit, poll `queued-batch`, and render terminal success/error with a link to the returned batch. The current docs describe add/remove operations against a scene and include complex scene-item attributes/relationships, so no raw JSON textarea and no automatic retry. Start with one narrow, supported repeated action (for example, add selected sources) only after the SDK matrix proves it.

## Routine framework generation versus required custom hooks

| Area                                               | Generated framework coverage                                                         | Explicit typed lifecycle/custom hook                                                                                                                     |
| -------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scenes                                             | list/get/basic create/update/delete envelopes, paging/filter state, SWR invalidation | list field/filter mapper; lifecycle-transition guard; camera/value mapper; merge orchestration; partial bulk-delete outcome reporting.                   |
| Scene items                                        | list/get/basic detail route where SDK verifies it                                    | source-type discriminated relationship picker; parent/reference-tree validation; structured transform/material/metadata mapper; assembly/viewer refresh. |
| Scene views/states                                 | resource list/get/basic CRUD only if API matrix confirms it                          | resolve scene from view; capture current viewer state as source; apply selected state in viewer; view-specific cache invalidation.                       |
| Stream keys                                        | none beyond a local action route                                                     | one-shot secret response, expiry validation, copy/open handoff and redaction; do not persist/cache/log it.                                               |
| Hits/canvases                                      | selected detail/list responses if supported                                          | viewer event → viewport/coordinate mapper; choose scene or scene-view target; field/include allowlist; selection/result bridge.                          |
| Model views/PMI                                    | server detail/list routes if SDK supports them                                       | viewer SDK paging bridge, has-annotations filter, model-view load/unload, Engage capability/permission fallback.                                         |
| Alterations/annotations/overrides/synchronizations | simple read routes first                                                             | selected-context binding, diff/preview calculation, typed domain payloads, async/polling or eventual-consistency status policy.                          |
| Batches                                            | queued-result/status envelope after support is verified                              | operation-builder allowlist, preflight validation, confirmation/diff, queued-batch polling and terminal redirect/result normalization.                   |

Do not dynamically dispatch SDK method names or accept arbitrary method/resource/body from the browser. Framework metadata must declare each allowed operation, field allowlist, relationship type, serializer, invalidations and custom hook.

## Safety, permission, and delivery requirements

- Preserve Next API routes as the only authenticated Platform boundary. The Web Viewer necessarily receives a stream key, but no React component should obtain an OAuth bearer token or client secret.
- Stream keys are security-sensitive. The current implementation copies the key and puts it in the viewer URL for sharing; URLs leak through browser history, analytics, screenshots and referrers. Treat a key as one-shot, avoid logging it or showing it in success text, use expiry disclosure, and have the implementor/security validator decide whether the existing shareable-URL behavior must be retained with safeguards or replaced by a safer handoff. Do not persist keys in SWR/local storage or details responses.
- Scene deletion, scene-item deletion, source replacement, batch remove, saved-state deletion and synchronization changes are destructive or widely visible. Require explicit confirmation naming the affected resource(s); for batches show a preview/diff and count. Report partial failures individually and reload canonical state.
- Scene commit/lifecycle transitions, scene item creation/updates, source translation effects, synchronizations and batches can be asynchronous or eventually consistent. Return operation IDs/status where provided, poll only non-terminal jobs, never optimistically claim the viewer reflects final persisted state, and make refresh/retry explicit.
- Not all signed-in applications have mutation/Engage/module permissions. A `403`/feature-unavailable result must leave navigation and read-only inspection usable, with an actionable message—not silently disable or replace it with client-side behavior.
- Use typed field editors for matrices, vectors, material colors/opacity, metadata and relationship IDs. Validate finite numeric ranges/shapes and supplied-ID uniqueness/parent-cycle rules before submitting; render API-provided metadata only as text.
- Viewer interactions must clean up listeners/abort stale fetches and tolerate a viewer not yet ready, stream-key expiry, a missing scene view, and an item deleted between selection and request.

## Concrete reuse and test plan

- Reuse `SceneTable` filters/selection/detail pattern, `SceneDrawer` structured field display, `CreateSceneDialog` source workflow, cursor paging utilities, and existing right/left Viewer drawers. Fix/migrate only after generated endpoint behavior is equivalent.
- Reuse the core group’s relationship picker, typed resource details sections, destructive confirmation and async job-status card; do not duplicate them within the viewer.
- Unit/MSW tests: request validation/allowlists, lifecycle and relationship mappers, bad parent/source choices, stream-key redaction/expiry, cache invalidations, view→scene resolution, viewer-not-ready behavior, action error envelopes, queued batch status/redirect/error normalization, and partial destructive outcomes.
- Component tests: synchronized item selection across tree/table/drawer, state gates, form validation, no raw secret rendering, PMI unavailable state, loading/error/empty data states, and mutation refresh.
- Playwright controlled-backend smoke: filter/select scene → open workspace → inspect/select an item → save/apply view state → generate a key without exposing it in UI history/logs → create a hit from an actual viewer gesture/mock dimensions → exercise one confirmed typed scene-item edit and confirmation → queue/poll one batch when implemented. Verify the browser view as well as API requests.

## Mandatory pre-implementation questions

Resolve these from the installed `0.44.0` declarations and current official docs; leave a written support matrix in the implementation handoff.

1. Exact CRUD/list nesting, body types, field/include parameters and paging for scene items, scene views, scene view states, canvases, alterations, annotations, overrides and synchronizations.
2. Which current scene mutations are asynchronous, which lifecycle state values/transitions are legal, and which response/job resource reliably represents terminal completion.
3. Canonical semantics and required relationships for scene alteration versus annotation versus item override, including whether they affect the rendered scene immediately or eventually.
4. Exact canvas and scene-view contracts; which endpoint the Viewer can legitimately call with its active `sceneViewId`.
5. SDK support split between `@vertexvis/api-client-node`, `@vertexvis/viewer` and `@vertexvis/viewer-react` for model views/PMI/hits, and the required Engage/module permissions.
6. Batch operation limits, atomicity/partial-failure semantics, queued-batch polling/redirect handling, and safe initial operation types.
7. Approved security behavior for passing short-lived stream keys to the Viewer route; this is an existing behavior that needs explicit review before expansion.
