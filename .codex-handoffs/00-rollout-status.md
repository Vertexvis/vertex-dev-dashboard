# Vertex API dashboard rollout — current state

**Snapshot:** 2026-07-22 at pushed commit `01fe78f`
(`codex/vertex-api-exercise-framework`, tracking
`origin/codex/vertex-api-exercise-framework`). This is the concise status
index; handoffs 01–28 are the detailed research, implementation, and
validation record.

## Working rules

The dashboard adds developer-focused, additive Platform API surfaces. Browser
code calls only local Next.js `/api/*` handlers; `withSession` and
`getClientFromSession` remain the credential boundary. Existing Scenes, Viewer,
Files, Parts, Documents, and established actions are compatibility contracts.

The Pages Router framework is a typed scaffold, not a generic API proxy. A
resource declares allowed operations in `api-resources.json`; generated
route/client files are thin adapters and developer-owned hooks contain typed
SDK calls plus lifecycle validation. New route contracts use the PR #326 Node
MSW harness, not container-based testing.

## Accepted and visible in the dashboard

| Area                      | Delivered capability                                                                                                                                                                                     | Important status / limit                                                                                                                                                                                                                       |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework and API catalog | Typed handler lifecycle, generator, query/body validation, same-origin client adapters, error normalization.                                                                                             | Accepted. Run `yarn api:generate:check` after manifest/generated changes.                                                                                                                                                                      |
| Core import/library       | File Collection membership management; hardened collection/Part handling; Files and File Collections confirm deletion while Parts retains its established no-confirmation UX.                            | Accepted. Async revision/rendition/geometry/translation mutations remain separate work.                                                                                                                                                        |
| Scene Workspace           | Authenticated, read-only `/scene-workspace/[sceneId]`, reached from existing Scene actions; overview, scene items, scene views, and embedded Viewer preview.                                             | Accepted. Scene states are scene-scoped and explicitly deferred; no new Scene/Viewer mutations. Stream keys are in-memory only for the preview and never enter URLs/storage.                                                                   |
| Documents Preview         | Documents list/filter/paging/detail, completed-File-gated registration, visible Preview capability states, and direct SPA File links.                                                                    | Accepted. Unsupported document update/delete/download actions are absent.                                                                                                                                                                      |
| Properties & Search       | Additive `/properties-search`: scoped Property Entries, safe Property Key Policy list, direct Search Session status, cursor controls, validated tab deep links, and capability/error states.             | Accepted (handoffs 22–23). Typed entry mutation, policy filtering/mutations, and search-session create/poll remain deferred pending verified contracts.                                                                                        |
| Identity & Administration | Additive `/identity-admin` via visible SPA drawer link: read-only user directory/memberships, application metadata, grants, explicit account lookup, masked webhook inspection, and OAuth2 safety panel. | Accepted (handoffs 24 and 27). No mutation/OAuth routes; webhook secret and raw endpoint components are redacted before browser serialization; `UserGroupsApi.getUserGroup` remains deferred for its SDK void-response mismatch.               |
| Scenes (Preview)          | Additive authenticated `/scenes-preview` via visible SPA drawer link; read-only familiar filters/paging, drawer selection, Workspace link, and an embedded Workspace Viewer preview.                     | Current pushed implementation (handoff 26). The original `/` Scenes workflow remains unchanged. The preview has no scene-create control and introduces **no scene-create redirect**; creation remains owned by the established root Scenes UX. |
| Node MSW migration        | Collection membership, Scene Workspace, and Documents contracts migrated to PR #326 exported-handler + authenticated-session + Node MSW.                                                                 | Committed and independently accepted (handoffs 20–21). Do not add or prioritize Testcontainers/MockServer coverage.                                                                                                                            |

## Safety gates and intentional deferrals

| Domain              | Current gate                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exports             | **Feature-gated and accepted only in that state.** `POST /api/exports` returns local 503 without constructing a client or calling Vertex until an authoritative export format/config/expiry profile is approved. Do not guess `step`, enable create/poll/download controls, or accept free-form format input. Existing queued redirect normalization and download redaction remain defensive plumbing, not an enabled export workflow. |
| Property entries    | Upsert/removal awaits verified discriminated value serialization and null/removal semantics.                                                                                                                                                                                                                                                                                                                                           |
| Property policies   | SDK 0.44.0 serializes `FilterExpression` incorrectly; filtering, create/detail/key mutations, and deletion stay deferred until a fixed SDK or approved typed profile exists. No raw Axios workaround.                                                                                                                                                                                                                                  |
| Search sessions     | Creation/polling await verified expiry bounds and terminal statuses.                                                                                                                                                                                                                                                                                                                                                                   |
| Identity/Admin      | User-membership UI pagination and broader 401/403/404 test coverage are follow-ups; account/grant/application/webhook mutations and OAuth flows require dedicated security review and one-shot-secret design.                                                                                                                                                                                                                          |
| Advanced Scene/Core | Scene alterations, annotations, overrides, synchronizations, batches, hits/canvases/model/PMI, and remaining part/file async workflows require their own typed contract and UX passes.                                                                                                                                                                                                                                                 |

## Current platform diagnostic

Handoff 28 documents the observed `/api/scenes` HTML 503. The upstream
Platform/gateway (or configured custom API host) produced the 503; the legacy
Scene handler then collapsed that unstructured Axios response to local 500.
PR #326 did not change this path. Treat upstream availability/routing as the
primary investigation, with a separate narrow safe error-status-preservation
fix if desired; never forward the HTML body.

## Next areas

1. **Collaboration Engage:** collaboration contexts, threads, replies, and
   attachments. Begin read-first and visibly handle Engage/preview capability
   states; attachment URLs remain one-shot and uncached.
2. **Advanced Scenes:** remaining scene APIs (alterations, annotations,
   overrides, synchronizations, batches, hits/canvases, model views/PMI) as
   independently planned read-first groups.
3. **Remaining Core/Jobs:** part revision/rendition/instance, file-job, and
   translation-inspection workflows after SDK/async lifecycle research.
4. **Deferred sensitive mutations:** revisit Exports, Properties mutations,
   Access Control, Webhooks, and OAuth only with authoritative contracts and
   the required security/one-shot-secret review.

## Verification baseline

Use the PR #326 Node MSW handler pattern: exported raw handler,
`invokeNextJsApiRouteHandler`, authenticated test session, and per-scenario
MSW upstream assertions. Browser/Playwright tests use the guarded local test
session and intercept only local `/api` routes. Standard gates are
`yarn api:generate:check`, `yarn lint`, relevant Node/browser Jest suites,
`yarn test:e2e`, `yarn build`, scoped Prettier/format checks, and
`git diff --check`.

At this snapshot the pushed branch is one commit ahead of and 18 commits behind
`origin/main`, with merge base `20f494f`. The worktree has no pending product
or test changes; this status-document update is intentionally documentation-only
and uncommitted.
