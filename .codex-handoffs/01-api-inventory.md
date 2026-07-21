# Vertex API inventory and rollout recommendation

## Scope and evidence

- The dashboard is intentionally a lightweight data-management and visual-inspection tool, not a replacement for Vertex Connect (`README.md`). Preserve that developer-focused posture: expose a useful workflow and request/response inspection rather than attempting a separate admin product.
- Official reference / Postman-shaped folders (checked 2026-07-21): [Vertex Platform API](https://docs.vertex3d.com/). It enumerates: `accounts`, `applications`, `attachments`, `batches`, `canvases`, `collaboration-contexts`, `documents`, `exports`, `files`, `file-collections`, `file-jobs`, `geometry-sets`, `hits`, `model-views`, `oauth2`, `part-renditions`, `part-revisions`, `part-revision-instances`, `parts`, `permission-grants`, `pmi`, `property-entries`, `property-key-policies`, `replies`, `scene-alterations`, `scene-annotations`, `scene-item-overrides`, `scene-items`, `scene-synchronizations`, `scene-views`, `scenes`, `scene-view-states`, `search-sessions`, `stream-keys`, `threads`, `translation-inspections`, `users`, `user-groups`, and `webhook-subscriptions`.
- The declared Node SDK is `@vertexvis/api-client-node@0.44.0` (`package.json`). Its installed declarations were not available in this fresh worktree, so the framework planner must first run `yarn install` and compare its generated API classes/methods to the reference. Do **not** silently implement newer documented endpoints with untyped raw Axios requests; first decide whether a deliberate SDK upgrade is required.

## Existing coverage

The existing end-user pages are `/` (Scenes), `/files`, `/file-collections`, `/parts`, `/translations`, and `/scene-viewer`. All authenticated upstream calls are server-side Next API routes protected by `withSession`; `getClientFromSession` creates the bearer-authenticated `VertexClient` (`src/lib/vertex-api.ts`).

| Domain                             | Existing upstream operations exposed through UI/server route                                                                                                                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Files                              | list (custom query to support richer filters/sort), create, binary upload via custom Multer storage engine, delete, details, download URL, and file-to-collection listing (`pages/api/files*`, `components/file/*`).                 |
| File collections / file jobs       | list, create, delete, get, list/add/remove collection files; archive workflow creates output file then file job, polls it, and downloads output (`pages/api/file-collections*`, `pages/api/file-jobs*`). No update collection route. |
| Parts / revisions / translations   | list, create, delete parts; list/get part revisions; queued translation inspection (`pages/api/parts*`, `part-revisions*`, `queued-translations.ts`).                                                                                |
| Scenes / scene items / stream keys | list, create, update, delete, get scenes; create scenes from a revision and merge scenes; get scene item; create a scene stream key (`pages/api/scenes*`, `merged-scenes.ts`, `scene-items/[id].ts`, `stream-keys.ts`).              |
| Viewer-related APIs/SDK            | get scene view indirectly; list/create scene view states; Web Viewer uses scene tree, model-view and PMI client SDK calls (`scene-viewer/[sceneId].tsx`, `pages/api/scene-view-states.ts`, `components/viewer/*`).                   |
| Auth                               | OAuth client-credentials sign-in/session refresh and current-user session endpoint only (`login.ts`, `vertex-api.ts`, `user.tsx`).                                                                                                   |

Important gaps inside otherwise-covered domains: file update, file collection update, direct collection-file removal/addition UX verification, file-job general operations, part revision create/update/delete and rendition/instance inspection, scene item CRUD and relationships, scene-view CRUD, scene-view-state get/update/delete, scene annotations/alterations/overrides/synchronization/hits/canvases, and all administration/collaboration/property/search/export/webhook areas.

## Recommended logical groups and UX

Order these as independently reviewable stacked PRs after the framework PR. Within every group, retain a standard resource table (server paging, sort/filter controls, row details drawer, destructive-action confirmation, operation status/error feedback) and generate only the routine list/get/create/update/delete wiring. Use lifecycle overrides for resource-specific filtering, selection fields, uploads, dependent-resource pickers, long-running job polling, custom request bodies, and viewer interactions.

1. **Framework and API catalog (prerequisite).** Build the route/client metadata catalog and handler generator first; migrate one existing resource as the reference implementation. Required lifecycle points: authenticate/client acquisition, request/query parse+validate, list query construction, `before/after` operation hooks, request body transform, response transform, error mapping, and client SWR key/mutation/invalidation hooks. The server implementation must preserve `withSession`, `getClientFromSession`, JSON:API headers, `getPage` cursor semantics, `toErrorRes`, and no secret/token exposure. Provide declarative operation metadata plus explicit typed overrides—do not dynamically invoke API-client methods from user input.

2. **Core import and library completion.** Files, file collections, file jobs, parts, part revisions, part renditions, part-revision instances, geometry sets, and translation inspections. UX: resource browser that completes the existing import-to-part workflow; collection metadata editing and association manager; job/translation polling panel; revision/rendition/instance detail tree. This has the strongest continuity with the existing dashboard and validates generator pagination/filter/lifecycle escape hatches.

3. **Scene composition and delivery completion.** Scenes, scene items, scene views, scene view states, stream keys, hits, canvases, model views, PMI, scene alterations, annotations, item overrides, synchronizations, and batches. UX: scene workspace/tabs with a resource inspector and viewer; structured editor for scene-item relationships/transform; operation/job status; generated stream key safeguards; viewer-driven hit/canvas operations. Keep high-risk/mutable viewer operations behind confirmation and typed forms, not a raw JSON default.

4. **Exports and documents.** Exports, queued exports, documents. UX: create export from selected scene/state, poll queued result, list/download completed artifacts; document list/details and source/state linkage. Reuse a generic asynchronous-job hook and download action from the import group.

5. **Properties and search.** Property entries, property key policies, search sessions. UX: scoped property explorer/editor that starts at a selected part revision/scene item, policy-aware key controls, search session query/results with explicit scope/context. This needs custom lifecycle/query and field-selection hooks; it should not block CRUD framework delivery.

6. **Collaboration.** Collaboration contexts, threads, replies, attachments. UX: context picker, conversation thread panel, reply composer, file/state attachment selection and upload/download. Treat the docs' preview-status attachment API as feature-flagged/clearly labelled and test its unsupported/error state.

7. **Account administration and integrations.** Accounts, applications, permission grants, users, user groups, webhook subscriptions, OAuth2. UX: separate Admin section, with secret-revealing operations deliberately one-shot and never stored/client-rendered; credential rotation/create confirmation; permission/user-group assignment tables; webhook endpoint/event/subscription inspector/test controls only where the API supports them. This belongs last because it is security-sensitive and commonly unavailable to ordinary dashboard credentials.

## Implementation constraints and acceptance criteria for every loop

- Add a grouping only after the researcher confirms current docs _and_ SDK support, documents permissions and destructive/async behavior, and identifies exact existing components/hooks to reuse.
- Use Next API routes as the credential boundary. Browser code calls local `/api/...`; no `VertexClient`, bearer token, client secret, or direct Platform host call in React.
- Each generated endpoint must explicitly declare allowed methods, typed input/output, pagination/filter/sort capabilities, and resource-specific lifecycle overrides. Reject unknown/invalid request data; retain normalized error handling.
- A group must include unit tests for generated route behavior and its overrides, component tests for primary/error/empty states, and a Playwright smoke flow using a controlled mocked/local authenticated backend where live Vertex credentials are unavailable. Validator must review source, test actual views, and report failures in the next handoff before the implementor loops.
- Keep migrations incremental: existing routes and UI must retain their contracts until their generated replacement has equivalent tests. Do not mix an SDK upgrade, framework rewrite, and a new API group in one PR.

## Suggested stacked PR sequence

1. `framework/api-resource-catalog` — catalog types, route/client generator, lifecycle contract, test harness; migrate a low-risk read-only existing resource.
2. `import/library-completion` — Group 2 using the framework.
3. `scene-workspace-completion` — Group 3 using the framework and viewer-specific overrides.
4. `exports-documents` — Group 4.
5. `properties-search` — Group 5.
6. `collaboration` — Group 6.
7. `admin-integrations` — Group 7.

Every PR should be draft, based on the immediately preceding branch, and contain the research + implementation + independent validation handoffs needed to restart that group's loop. Reprioritize only after validation or an SDK/documentation mismatch is recorded.
