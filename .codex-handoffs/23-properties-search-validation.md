# Properties & Search — independent validation

## Verdict

**Rejected for repair.** The delivered read-only surface is additive, preserves
the session/credential boundary, uses the PR #326 Node MSW route harness, and
passes its executed automated checks. Two functional/coverage gaps prevent
acceptance of this Properties & Search increment: neither API list exposes
cursor pagination, and policy capability failures have no component or
Playwright regression coverage.

## Scope reviewed

- New `/properties-search` page and one additive **Properties & Search**
  dashboard-drawer link.
- Generated collection/detail route stubs with developer-owned typed hooks for
  Property Entries, Property Key Policies, and Search Sessions.
- Node MSW route contract, component, and Playwright coverage.

Existing Viewer metadata, Scenes, Files, Parts, Documents, and Scene Workspace
source was not altered by this Properties/Search increment. The drawer change
is additive.

## Security and route-boundary review

Accepted findings:

1. Browser code uses only same-origin `/api/*` requests. No browser-to-Vertex
   request, bearer value, client secret, token, or raw generic API proxy is
   present in the Properties/Search source.
2. `propertyKeyPoliciesFromClient` creates
   `new PropertyKeyPoliciesApi(client.config, undefined, client.axiosInstance)`.
   It does not recover credentials or create an Axios request itself. The Node
   MSW test proves the configured authenticated request is used.
3. Property Entries rejects absent/repeated/blank resource filters and rejects
   any resource type outside `scene-item`, `part-revision`, `part-instance`,
   and `property-set` before the session client is constructed. It clamps page
   size to 100 and never permits an unfiltered account-wide UI request.
4. Property-policy supplied-ID/operator filtering is safely rejected rather
   than sending the known-bad SDK `[object Object]` serialization. The feature
   is correctly deferred; it must not be replaced by raw Axios.
5. Search-session inspection accepts a single explicit ID and preserves an
   upstream 403 through the normal route-error path. The UI does not put the
   loaded result or credentials in the URL.
6. No new Testcontainers/MockServer/Docker test dependency was found. The
   route suite uses `installNodeMswServer`,
   `createAuthenticatedVertexApiTestSession`, and
   `invokeNextJsApiRouteHandler` from the PR #326 harness.

## Defects requiring repair

### P1 — List routes return cursors but the UI cannot exercise pagination

**Reproduction:** Open `/properties-search`, load a Property Entries target or
the Key policies tab. Return a local route result whose `cursors.next` is
present. The page renders a table but has no next/previous controls and does
not include a cursor in subsequent SWR keys.

**Evidence:** `PropertiesSearchPage.tsx` always requests
`pageSize=25` and has no cursor state/control for either `entries` or
`policies`, even though both hooks return `GetRes` with `cursors`.

**Impact:** Only the first page is inspectable. This does not fully exercise
the documented list APIs and misses the required cursor-paged Property
Inspector / Key Policies behavior.

**Repair:** Reuse the existing cursor pagination control/pattern for both
tables. Reset the cursor when the entry target changes; keep policy filtering
deferred, but paginate the unfiltered policy list. Add component and Playwright
coverage that asserts the exact cursor passed to the local route.

### P1 — Policy 403 capability behavior lacks regression coverage

**Reproduction:** The UI has a `DisplayError` path, but the test suite contains
no component or Playwright scenario that returns `/api/property-key-policies` 403. `PropertiesSearchPage.test.tsx` covers entries and Search Sessions only;
`e2e/properties-search.spec.ts` covers entries and a successful session load
only.

**Impact:** The implementation handoff explicitly requires policy-403 coverage
before accepting broader UX. A policy permission regression could be rendered
as an empty/loading state without browser-level detection.

**Repair:** Add an MSW component test and a local-only Playwright route fixture
for policy 403, asserting that the upstream message is visible and the result
is not presented as an empty list. Include Search Session 403 in the e2e flow
or document why the existing component coverage is the chosen boundary.

### P2 — Generated Properties/Search API route files fail Prettier

**Reproduction:**

```sh
yarn prettier --check src/pages/api/property-entries.ts \
  src/pages/api/property-key-policies.ts \
  'src/pages/api/search-sessions/[id].ts'
```

reports all three files as unformatted. The complete `yarn format:check` also
fails because its glob includes ignored generated coverage/e2e artifacts; the
scoped command isolates the new-source failure.

**Impact:** The generated template conflicts with the project formatting gate;
the implementation handoff's claim that both format and generator check passed
cannot be true at the same final revision.

**Repair:** Update the generator template (or its post-generation formatting
step) so `yarn api:generate:check` and scoped Prettier are simultaneously
clean. Do not hand-edit generated route output without resolving generator
drift.

### P2 — Tabs are not deep-linkable as planned

`/properties-search?tab=policies` still renders Entries because tab state is
only local React state. This is not a security issue, but it misses the
research handoff's stated deep-linkable-tab UX. Either implement a validated
`tab` query value or explicitly revise the plan/hand-off scope.

## Independent checks

| Check                                                   | Result                              |
| ------------------------------------------------------- | ----------------------------------- |
| `yarn api:generate:check`                               | Passed                              |
| `git diff --check`                                      | Passed                              |
| Focused Node MSW Properties/Search route suite          | Passed: 1 suite / 4 tests           |
| Focused browser component suite                         | Passed: 1 suite / 2 tests           |
| Full Node project (`--selectProjects node --runInBand`) | Passed: 16 suites / 107 tests       |
| `yarn lint`                                             | Passed: no warnings/errors          |
| `yarn build`                                            | Passed                              |
| Local-only Playwright scoped flow                       | Passed: setup + 1 Chromium scenario |
| Scoped Prettier on new Properties/Search files          | Failed: 3 generated route files     |

The initial sandboxed Playwright run could not bind port 3100 (`EPERM`); the
same local browser command passed after the required local port permission was
granted. No container-based test was run or requested.

## Suggested repair order

1. Repair generator formatting in a way that keeps generator drift checks
   green.
2. Implement cursor pagination with reset behavior and component/e2e tests.
3. Add policy-403 coverage; optionally add the validated `tab` query behavior.
4. Re-run Node MSW, browser, Playwright, lint, build, generator, scoped
   Prettier, and diff checks without containers.

---

## Revalidation — 2026-07-21

### Verdict

**Accepted for the Properties & Search scope.** All four previously reported
Properties/Search findings are repaired. The current global build result is
blocked by unrelated, concurrently in-progress Identity/Admin source (detailed
below), not by this increment; focused Properties/Search contracts, component
tests, browser exercise, generator drift, and scoped formatting pass.

### Repair verification

1. **Cursor pagination and reset:** Both Entries and Key policies now retain a
   separate cursor state, append it to the local same-origin SWR URL, offer
   **Next page** only when the returned `cursors.next` exists, and offer
   **First page** after moving away from the first page. `loadEntries` clears
   the entry cursor before setting the new target. Component and Playwright
   fixtures independently assert the follow-up URLs contain `cursor-2`,
   `entry-cursor-2`, and `policy-cursor-2` respectively.
2. **Policy 403 behavior:** The browser component suite returns a local 403
   from `/api/property-key-policies` and verifies the failure is shown rather
   than the empty-list copy. The separate local-only Playwright fixture opens
   `/properties-search?tab=policies` with a 403 response and makes the same
   assertion.
3. **Deep-linkable tabs:** A validated `?tab=entries|policies|sessions` is
   read from `next/router`; invalid/multiple values retain Entries. User tab
   changes call shallow `router.replace`, preserving SPA navigation. Component
   coverage verifies direct `?tab=policies` and shallow replacement to
   `?tab=sessions`; Playwright exercises direct policy deep linking.
4. **Generator formatting/drift:** The generator now emits the multiline
   handler construction required by Prettier. Generated Properties/Search
   routes pass scoped Prettier while `yarn api:generate:check` remains clean.
5. **Harness boundary:** The Properties/Search route contracts continue to use
   the PR #326 authenticated-session + Node MSW handler invocation. No
   Testcontainers, MockServer, Docker, raw Axios proxy, or browser credential
   handling was introduced.

### Independent checks rerun

| Check                                                                 | Result                               |
| --------------------------------------------------------------------- | ------------------------------------ |
| `yarn api:generate:check`                                             | Passed                               |
| Scoped Prettier (generator, new UI/tests/e2e, all 3 generated routes) | Passed                               |
| `git diff --check`                                                    | Passed                               |
| Focused Node MSW Properties/Search route suite                        | Passed: 1 suite / 4 tests            |
| Focused browser Properties/Search suite                               | Passed: 1 suite / 4 tests            |
| Full Node project (`--selectProjects node --runInBand`)               | Passed: 16 suites / 107 tests        |
| Local-only Playwright repaired flows                                  | Passed: setup + 2 Chromium scenarios |

`yarn lint` reports two warnings and `yarn build` fails because concurrent,
unrelated Identity/Admin work currently has an unused `MenuItem` import in
`src/components/identity-admin/IdentityAdminPage.tsx` (and an import-sort
warning in `src/lib/resources/identity-admin/identity-admin.client.ts`). The
build stops at that Identity/Admin type error before any Properties/Search
failure. This does not invalidate the accepted scoped repair, but the overall
combined worktree cannot pass the global build until that active adjacent work
is repaired.

The Playwright server again required the local port permission; after it was
granted, all three selected tests passed. No container-based test was run.
