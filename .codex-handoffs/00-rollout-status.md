# Vertex API dashboard rollout — current state

**Snapshot:** 2026-07-21. This is the single starting point for the API
exercise rollout. It summarizes handoffs 01–23; the numbered handoffs remain
the detailed evidence and implementation record.

## Goal and working rules

The dashboard is adding developer-focused, additive surfaces for the Vertex
Platform API. Browser code calls only local Next.js `/api/*` handlers; those
handlers retain `withSession` / `getClientFromSession` as the Vertex credential
boundary. Existing dashboard workflows are compatibility contracts: do not
replace the Viewer, Files, Parts, Scenes, or current actions while adding a
new API area. Use SPA links for new navigation.

The reusable Pages Router framework is intentionally a scaffold, not a dynamic
API proxy. A resource must declare its operations in `api-resources.json`; the
generator creates thin route/client files while developer-owned `*.hooks.ts`
files contain typed SDK calls and lifecycle overrides for special behavior.

## Completed and accepted

| Area                      | Delivered capability                                                                                                                                                                                                                                                                     | Acceptance / important limits                                                                                                                                                                       |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework and API catalog | Typed route dispatcher/lifecycle hooks, query/body validation, error normalization, same-origin client adapters, deterministic generator and manifest. Files is the reference migration.                                                                                                 | Accepted after generator-ownership, detail-route, mutable-body, and E2E-secret repairs. Run `yarn api:generate:check` whenever a manifest/generated file changes.                                   |
| Core import/library       | Preserved Files/Parts behavior; File Collection membership add/remove UI and routes; hardened collection IDs, Part errors, and relevant cache invalidation. Files and File Collections have deletion confirmation; Parts intentionally retains its original no-confirmation deletion UX. | Accepted. Async revision/rendition/geometry/translation mutation work is not included.                                                                                                              |
| Scene Workspace           | Additive authenticated, read-only `/scene-workspace/[sceneId]`, reached from **Open workspace** in the Scene actions. It inspects overview, scene items, and scene views without changing Viewer or stream-key flows.                                                                    | Accepted. Scene states are explicitly deferred: Vertex lists them by scene and does not establish a selected-scene-view relationship. No stream keys or mutations are exposed.                      |
| Documents Preview         | Additive Documents page/list, completed-File-gated registration, cursor/filter/detail capability states, and direct SPA File links (`/files?fileId=<id>`).                                                                                                                               | Accepted. Preview 403 is a visible capability state; no unsupported document update/delete/download actions were added.                                                                             |
| Exports safety boundary   | Read/detail/download plumbing and a Scene Workspace exports tab.                                                                                                                                                                                                                         | Accepted **only as feature-gated**: export start returns local 503 and the UI cannot create/poll/download an export until an authoritative Vertex export format/config/expiry profile is available. |
| Test-harness migration    | The new collection-membership, Scene Workspace, and Documents contract suites were moved from Testcontainers/MockServer to the PR #326 exported-handler + authenticated-session + Node MSW pattern.                                                                                      | Independently accepted. This migration is test-only and currently uncommitted in the worktree. No new container tests should be added.                                                              |

## Current active area: Properties & Search

`/properties-search` and its additive drawer link have been implemented but
**are not accepted**. It currently provides only safe read paths:

- scoped Property Entries list (requires both a resource ID and an allowed
  relationship type; it cannot request an account-wide list);
- Property Key Policies list through a server-only typed adapter that reuses
  the session client's configuration and Axios instance; and
- explicit-ID Search Session status inspection.

Independent validation (handoff 23) rejected this increment for repair. The
required repair is:

1. Fix generator/template formatting so generated routes and
   `yarn api:generate:check` are both Prettier-clean.
2. Add cursor pagination to Property Entries and Policies; reset the Entries
   cursor when the target changes, and assert local API cursor requests in
   component and Playwright tests.
3. Add explicit Policy 403 capability coverage (and Search Session 403 browser
   coverage or a documented rationale).
4. Implement validated `?tab=` deep linking, or explicitly narrow the plan.
5. Re-run the Node MSW, browser, local Playwright, lint, build, generator,
   Prettier, and diff checks. Do not add Testcontainers/Docker coverage.

## Explicit SDK/documentation deferrals

These are intentional safety/accuracy gates, not missing generic CRUD work.

| Domain            | Deferred until verified                                                                                                                                                                                                                                                      |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exports           | Exact accepted format token/configuration and expiry profile. Never guess `step` or send a free-form format. Re-enable creation only with new Node MSW and Playwright coverage.                                                                                              |
| Property entries  | Upsert/removal: verify discriminated value serialization and whether `null` removes a value.                                                                                                                                                                                 |
| Property policies | The pinned `@vertexvis/api-client-node@0.44.0` serializes `FilterExpression` as `[object Object]`. Keep filtering, create/detail/key-entry mutations, and deletion deferred until a fixed SDK or approved typed client profile exists; do not work around it with raw Axios. |
| Search sessions   | Creation and polling: verify permitted expiry range and terminal statuses first.                                                                                                                                                                                             |
| Scene Workspace   | Scene view-state association, viewer-led hit/canvas interactions, scene mutations/synchronization/batches, and any stream-key-adjacent action require separate typed contracts and security review.                                                                          |
| Core library      | Part revision/rendition mutations, geometry-set creation, translation-inspection creation, and unavailable part-revision-instance detail/mutation need dedicated async/relationship UX and contracts.                                                                        |

## Planned but not started API areas

The full Platform inventory is in handoff 01. The next independent dashboard
areas are deliberately split so a validation failure does not block unrelated
work:

1. **Collaboration Engage:** collaboration contexts, threads, replies, and
   attachments. Start read-first; attachment/Engage preview support must show
   unavailable/permission states safely.
2. **Identity directory:** users and user groups, including resolving the
   documented-versus-SDK `UserGroupsApi.getUserGroup` mismatch before a detail
   surface is designed.
3. **Access control:** accounts, applications, and permission grants. Treat as
   security-sensitive, with a dedicated security validator before mutations.
4. **Integrations/security:** webhook subscriptions and OAuth2. One-shot secret
   material may never be stored, cached, logged, or rendered after creation.
5. Remaining API families from the inventory—attachments/batches/canvases,
   geometry/model/PMI, scene alterations/annotations/overrides/
   synchronizations/hits, part revision/rendition/instance completion, file
   jobs, and translation inspections—should be decomposed into read-first
   workflows after their SDK matrix and permissions are recorded.

## Test baseline

PR #326's Node MSW Next.js handler harness is the project baseline for new API
route contracts. Use exported raw handlers with
`invokeNextJsApiRouteHandler`, an authenticated test session, and per-scenario
MSW upstream handlers that assert the SDK request path/query/body. The shared
server rejects unhandled outbound requests. Browser tests use the guarded local
test session and intercept only local `/api` requests.

Historical handoffs mention Docker/Testcontainers because that was the old
harness. Those results are evidence for the prior work, but future work must
not add or prioritize container-based tests. The standard gates now are
`yarn api:generate:check`, `yarn lint`, `yarn test --selectProjects node
--runInBand`, `yarn test --selectProjects browser --runInBand`, `yarn test:e2e`,
`yarn build`, `yarn format:check`, and `git diff --check`.

Run focused equivalents during a repair; run the full relevant gates before an
area is accepted. Local Playwright needs the existing guarded test-session
launcher and a port the environment permits it to bind.

## Git and upstream integration state

- Branch/worktree: `codex/vertex-api-exercise-framework` at
  `/private/tmp/vertex-dev-dashboard-vertex-api-exercise`.
- `1b7bb24` is the framework checkpoint; `a35bf5f` contains the accepted Core,
  Scene Workspace, and Exports/Documents product work; `a2e3250` is the local
  merge of PR #326's test-harness work.
- The branch currently has uncommitted test-harness migration changes and the
  unaccepted Properties/Search increment. Keep those concerns separate when
  checkpointing; do not bundle a rejected area with accepted work.
- At this snapshot the branch is 17 commits ahead of `origin/main`; its merge
  base is `20f494f`. PR #326 is integrated locally for this worktree; verify
  remote PR/branch state before any future publish rather than assuming the
  local merge means `origin/main` contains it.

## Ordered next actions

1. Finish and independently validate the Properties/Search repair above, then
   checkpoint it separately only after acceptance.
2. Checkpoint the already accepted Node-MSW migration separately if it has not
   been committed, preserving the no-container baseline.
3. Dispatch Collaboration research/SDK verification and a separate Identity
   SDK-mismatch investigation in parallel; no product implementation starts
   before each has its API/permission/UX handoff.
4. Implement and validate Collaboration read-first. Then implement Identity
   only after its SDK decision is explicit.
5. Research Access Control and Integrations in parallel, followed by a
   security-validator handoff before any sensitive mutation/secret flow.
6. Revisit deferred Exports, Properties mutations, Scene advanced operations,
   and Core async operations only when their authoritative contracts are
   available.

Each group follows: research/plan → implementation → independent validation →
targeted repair loop until accepted. Add a numbered handoff at each transition
and update this document when the status changes.
