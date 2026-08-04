# PR #353 Review Issues — Property Key Policies

Findings from an adversarial review of PR #353 (`PLAT-8994_create_delete_property_key_policies`,
"Create and delete property key policies"). Ordered by severity. Each item is
self-contained so it can be fixed independently. All quality gates currently pass on the
branch (typecheck, lint, format, 136 tests / 23 suites) — keep them passing.

---

## 1. Detail page has zero test coverage

**File:** `src/pages/property-key-policies/[propertyKeyPolicyId].tsx` (0% in coverage report)

`serverSidePropsHandler` is exported for testability (same pattern as
`src/pages/file-collections/[fileCollectionId].tsx`, which sits at ~86% coverage) but has no
tests. It contains real logic: missing id → `notFound`, upstream 400/404 → `notFound`, other
upstream failures → `throw`.

**Fix:** Add tests mirroring how the file-collections detail page is tested — cover
`serverSidePropsHandler` (success, missing id, 404 → notFound, 500 → throw) and ideally a
render test of the page component (breadcrumbs, metadata table, entries list states).

## 2. Single-policy GET endpoint is dead code

**File:** `src/pages/api/property-key-policies/[id]/index.ts`

No UI code calls `GET /api/property-key-policies/[id]`. The details drawer renders from the
row prop and only fetches `/entries`; the detail page fetches the policy server-side via the
SDK. Only the endpoint's own tests exercise it.

**Fix (pick one):**
- Remove the route and its tests (`src/__tests__/pages/api/property-key-policies.test.ts`
  has `callPolicyById` cases) until the planned edit feature needs it, **or**
- Keep it and note in the PR description that it is groundwork for the edit follow-up.

## 3. Unbounded pagination loop in the entries route

**File:** `src/pages/api/property-key-policies/[id]/entries.ts:49-62`

The `do/while` loop that aggregates all entry pages has no cap on iterations and no defense
against a repeated cursor. If the upstream ever returns a `next` link with the same cursor,
the handler loops forever. A policy with very many entries also produces an unbounded number
of upstream calls and an unbounded response payload.

**Fix:** Add a max-page guard (e.g., bail after N pages) and/or stop when the next cursor
equals the current one. Log/flag truncation if the cap is hit. Add a test for the
repeated-cursor case.

## 4. Stale cross-page selection + no delete confirmation

**File:** `src/components/property-key-policy/PropertyKeyPolicyTable.tsx`

`selected` is never cleared on page change or filter change. A user can check a row, page or
filter away (the row is no longer visible), then hit Delete and remove policies they cannot
see — and this PR removed the delete confirmation dialog, so it's a single click. (The
stale-selection behavior is inherited from `FileCollectionTable`, but removing confirmation
raises the stakes.) Related: the header checkbox's `numSelected` can exceed `rowCount` once
off-page selections accumulate.

**Fix:** Clear `selected` when paging changes (`handleChangePage`) and when filters reset
paging (`resetPaging` path / `debouncedSetSuppliedIdFilter`). Add a component test: select a
row, change page, assert selection is empty.

## 5. Duplicate-policy path on create response parse failure

**File:** `src/components/property-key-policy/CreatePropertyKeyPolicyDialog.tsx:179-190`

If the POST succeeds server-side but `res.json()` throws (or the connection drops after the
server processed the request), the `catch` sets the generic "Could not create..." error and
leaves the Create button enabled — resubmitting creates a duplicate policy. This undermines
the deliberate duplicate-avoidance UX in the partial-failure path.

**Fix:** Separate the `fetch` and `res.json()` error handling: if the fetch resolved
(a response was received) but the body can't be parsed, treat it as an unknown-outcome state
— e.g., warn that the policy may have been created and suggest checking the list before
retrying (or refresh the list and check). At minimum, document the accepted risk.

## 6. Dead validation code in the create dialog

**File:** `src/components/property-key-policy/CreatePropertyKeyPolicyDialog.tsx:158-165`

The submit-time checks ("Name is required." / "Add at least one property key.") are
unreachable: `submitDisabled` disables the Create button under exactly those conditions, and
there is no `<form>`, so Enter cannot trigger submit (Enter in key fields is intercepted).
The `validationError` alert block and the `error={validationError != null && name.trim() === ""}`
prop on the Name field can never fire.

**Fix:** Remove `validationError` state, its alert, the unreachable checks in
`handleSubmit`, and the Name field's `error` prop — or wire up real form submission so they
are reachable, and test them.

---

## Minor

- **`name` not trimmed server-side:** `src/pages/api/property-key-policies.ts` — in
  `parseCreatePropertyKeyPolicyReq`, `suppliedId` is trimmed but `name` is passed upstream
  untrimmed (only trim-checked for emptiness). The client trims before sending, so only
  direct API callers hit it. Make the two fields consistent (trim `name` too).
- **Batch delete reports only the first failure:** `src/pages/api/property-key-policies.ts`
  (`del`) — `results.find(isErrorFailure)` discards other outcomes. The UI re-fetch re-syncs
  the list, but the error message could note that some deletions may have succeeded.
- **Toolbar Delete button not disabled while deleting:**
  `PropertyKeyPolicyTable.tsx` — the `deleting` guard is handler-only; a second click
  silently no-ops with no visual feedback. Pass a disabled state through `TableToolbar`.
- **Stale PR description test counts:** PR body says 126 tests / 22 suites; the branch has
  136 / 23. Update the PR description.

## Explicitly NOT issues (checked during review — don't "fix" these)

- Raw axios + hand-built query in the list route instead of the SDK's
  `listPropertyKeyPolicies`: justified (SDK mis-serializes `FilterExpression`) and matches
  `scenes.ts` / `files.ts` / `file-collections.ts`.
- Delete without confirmation as a direct toolbar action matches the
  `FileCollectionTable` precedent (issue 4 above is about the stale-selection interaction,
  not the direct action itself).
- `key={index}` on the dialog's key fields is safe for controlled inputs.
- The per-render `useEffect` on the recreated `page` object is harmless (the `setCursors`
  value is referentially stable from the SWR cache) and inherited from existing tables.
- Missing `Content-Type` header on the DELETE fetch matches existing tables; the API route
  handles both string and parsed-object bodies (tested).
