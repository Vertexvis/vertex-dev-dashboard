# Linting

The dashboard adopts strict, connect-app-aligned ESLint enforcement: a modern
flat config, `eslint . --max-warnings=0`, and type-aware rules. The change is
delivered as a six-layer stacked-PR series (parent ticket PLAT-9101, previewed
end-to-end in [PR #370](https://github.com/Vertexvis/vertex-dev-dashboard/pull/370))
so that each rule group activates in the same PR as the fixes for its findings.
This document is the reference for the adopted ruleset, where each rule comes
from, when it activates in the stack, and what it changed in this codebase.

## Enforcement model

- Configuration lives in a flat `eslint.config.mjs` at the repository root; the
  legacy `.eslintrc.js` is removed.
- `yarn lint` runs `eslint . --max-warnings=0` — warnings fail the build.
- The same `yarn lint` runs in the lefthook pre-commit hook and in CI, so local
  commits and pull requests are gated identically.
- Type-aware rules use `parserOptions.projectService`, sharing the TypeScript
  project info used by the editor and `tsc`.
- Next.js build-time linting is disabled (`eslint.ignoreDuringBuilds`) in favor
  of running ESLint directly.
- `eslint-config-prettier` is applied last, so formatting stays Prettier's job.
- `no-console` is deliberately NOT enabled.

## Rules

Source categories:

- **Vertexvis preset** — from `@vertexvis/eslint-config-vertexvis-typescript`
  and its base `@vertexvis/eslint-config-vertexvis` (upstream shared rules).
- **Standard (eslint/tseslint recommended)** — eslint or typescript-eslint
  recommended sets.
- **Next.js (eslint-config-next)** — the `next` / core-web-vitals configs.
- **connect-app convention** — adopted because connect-app established it.
- **dev-dashboard declaration** — explicitly chosen by this repository.

"Activated in" is the stacked PR in which the rule starts being enforced; rules
that were present and passing from the start of the stack activate in PR 1.

| Rule                                               | Severity | Source                                 | Activated in     | Notes                                                                                                                                         |
| -------------------------------------------------- | -------- | -------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| typescript-eslint `recommended` set                | error    | Standard (eslint/tseslint recommended) | PR 1 (PLAT-9103) | Full set (`no-explicit-any`, `ban-ts-comment`, `no-require-imports`, …) spread in by the Vertexvis preset                                     |
| `react/recommended` + `@next/next/recommended`     | mixed    | Next.js (eslint-config-next)           | PR 1 (PLAT-9103) | Via `eslint-config-next` through FlatCompat                                                                                                   |
| `@next/next/core-web-vitals`                       | error    | Next.js (eslint-config-next)           | PR 1 (PLAT-9103) | Raises key Next.js rules from warn to error                                                                                                   |
| `react-hooks/rules-of-hooks`                       | error    | dev-dashboard declaration              | PR 1 (PLAT-9103) | react-hooks v6 registered natively (flat config); eslint-config-next's bundled copy is stripped                                               |
| `react-hooks/exhaustive-deps`                      | error    | dev-dashboard declaration              | PR 1 (PLAT-9103) | Recommended default is warn; raised to error                                                                                                  |
| `react-hooks/immutability`                         | error    | dev-dashboard declaration              | PR 5 (PLAT-9107) | Compiler-backed v6 rule; `src/**/*.{ts,tsx}` only                                                                                             |
| `@typescript-eslint/no-floating-promises`          | error    | dev-dashboard declaration              | PR 4 (PLAT-9106) | Type-aware; findings must be resolved semantically, not suppressed                                                                            |
| `@typescript-eslint/no-misused-promises`           | error    | dev-dashboard declaration              | PR 4 (PLAT-9106) | Type-aware; catches async handlers passed to void-returning props                                                                             |
| `@typescript-eslint/await-thenable`                | error    | dev-dashboard declaration              | PR 5 (PLAT-9107) | Type-aware; completes the typed async trio                                                                                                    |
| `no-restricted-syntax` (`let` ban)                 | error    | connect-app convention                 | PR 3 (PLAT-9105) | connect-app's production-`.tsx` no-`let` convention; the file-scoped selector implementation is dev-dashboard's; tests and `.ts` files exempt |
| `prefer-const`                                     | error    | dev-dashboard declaration              | PR 1 (PLAT-9103) | Explicitly set in the local config                                                                                                            |
| `no-var`                                           | error    | dev-dashboard declaration              | PR 1 (PLAT-9103) | Explicitly set in the local config                                                                                                            |
| `@typescript-eslint/explicit-function-return-type` | error    | Vertexvis preset                       | PR 2 (PLAT-9104) | `allowExpressions: true`; temporarily off in PR 1, re-enabled with the annotations in PR 2                                                    |
| `@typescript-eslint/member-ordering`               | error    | Vertexvis preset                       | PR 1 (PLAT-9103) |                                                                                                                                               |
| `@typescript-eslint/explicit-member-accessibility` | error    | Vertexvis preset                       | PR 1 (PLAT-9103) | Off for plain JS files                                                                                                                        |
| `@typescript-eslint/consistent-type-definitions`   | error    | Vertexvis preset                       | PR 1 (PLAT-9103) | `interface` over `type` for object shapes                                                                                                     |
| `@typescript-eslint/no-unused-vars`                | error    | Vertexvis preset                       | PR 1 (PLAT-9103) | `{ args: 'none' }` — unused parameters allowed, unused bindings are not                                                                       |
| `simple-import-sort/imports`                       | error    | Vertexvis preset                       | PR 1 (PLAT-9103) | Re-asserted in the local config                                                                                                               |
| `simple-import-sort/exports`                       | error    | Vertexvis preset                       | PR 1 (PLAT-9103) | Re-asserted in the local config                                                                                                               |
| `eqeqeq`                                           | error    | Vertexvis preset                       | PR 1 (PLAT-9103) | `smart` mode — `==` allowed only for `null` checks and same-type literals                                                                     |
| `yoda`                                             | error    | Vertexvis preset                       | PR 1 (PLAT-9103) |                                                                                                                                               |
| `padding-line-between-statements`                  | error    | Vertexvis preset                       | PR 1 (PLAT-9103) | Blank lines between functions/classes and after imports                                                                                       |
| `lines-between-class-members`                      | error    | Vertexvis preset                       | PR 1 (PLAT-9103) | `exceptAfterSingleLine: true`                                                                                                                 |
| `indent` / `@typescript-eslint/func-call-spacing`  | error    | Vertexvis preset                       | PR 1 (PLAT-9103) | Declared by the preset but disabled again by `eslint-config-prettier` — formatting belongs to Prettier                                        |
| `testing-library/await-async-events`               | error    | connect-app convention                 | PR 1 (PLAT-9103) | Matches connect-app's testing-library rule set; scoped to test files (dev-dashboard declaration)                                              |
| `testing-library/no-await-sync-events`             | error    | connect-app convention                 | PR 1 (PLAT-9103) | Test files only                                                                                                                               |
| `testing-library/no-wait-for-multiple-assertions`  | error    | connect-app convention                 | PR 1 (PLAT-9103) | Test files only                                                                                                                               |
| `testing-library/no-wait-for-side-effects`         | error    | connect-app convention                 | PR 1 (PLAT-9103) | Test files only                                                                                                                               |
| `testing-library/no-unnecessary-act`               | error    | connect-app convention                 | PR 1 (PLAT-9103) | Test files only                                                                                                                               |

Preset relaxations worth knowing: `@typescript-eslint/no-use-before-define` is
off, and plain JS files (`*.js`, `*.mjs`, `*.cjs`) are exempt from return-type,
member-accessibility, and require-import rules.

## Impact on this codebase

The stack activated rules layer by layer, fixing each layer's findings in the
same PR. The pre-stack baseline against the final config was 231 errors.

### PR 1 (PLAT-9103) — toolchain and config, 11 misc fixes

Upgrades ESLint 7 → 8.57, adopts the flat config and the presets, and fixes the
11 findings the initial rule set surfaced: 2 import-sort orderings, 3 blank-line
paddings, 3 `type` → `interface` conversions, 2 unused `catch` bindings, and 1
missing `public` accessibility modifier.

### PR 2 (PLAT-9104) — 130 explicit return types

Annotates all 130 functions flagged by `explicit-function-return-type` across
41 files. Conventions: React components → `JSX.Element`, async functions →
`Promise<void>`/`Promise<T>`, sync handlers → `void`.

```tsx
// Before
function handleClick(s: Scene) {
  setScene(s);
}

// After
function handleClick(s: Scene): void {
  setScene(s);
}
```

### PR 3 (PLAT-9105) — 7 `let` sites removed from production `.tsx`

Refactors the 7 `let` declarations in production `.tsx` files, mostly
conditional `tableRows` assembly, into extracted pure functions:

```tsx
// Before
let tableRows: React.ReactNode;
if (loadError) {
  tableRows = <DataLoadError colSpan={headCells.length} />;
} else if (!page) {
  tableRows = <SkeletonBody /* … */ />;
} else {
  tableRows = page.items.map((row) => /* … */);
}

// After
function renderTableRows(): React.ReactNode {
  if (loadError) return <DataLoadError colSpan={headCells.length} />;
  if (!page) return <SkeletonBody /* … */ />;
  return page.items.map((row) => /* … */);
}

const tableRows = renderTableRows();
```

### PR 4 (PLAT-9106) — 78 promise-safety findings

Resolves 46 `no-floating-promises` and 32 `no-misused-promises` findings
semantically — awaiting, returning, or attaching rejection handlers — and adds
the `src/lib/report-error.ts` helper for intentional fire-and-forget calls. The
most common shape is an async handler passed directly to a void-returning
event prop:

```tsx
// Before: async function where a void handler is expected
<Button onClick={handleSignOut}>Sign Out</Button>;

// After: explicit wrapper with a rejection handler
<Button
  onClick={() => {
    handleSignOut().catch(reportError("Failed to sign out"));
  }}
>
  Sign Out
</Button>;
```

### PR 5 (PLAT-9107) — 1 immutability + 2 await-thenable findings

Enables `react-hooks/immutability` and `await-thenable`. Fixes one
use-before-declaration in `Viewer.tsx` and removes two redundant `await`s of
non-Promise values in a test.

```tsx
// Before: handleShortcutS captured before it is declared
useHotkeys("s", () => handleShortcutS(), { keyup: true });

function handleShortcutS(): void {
  ref?.current?.focus();
}

// After: declaration moved above the capture
function handleShortcutS(): void {
  ref?.current?.focus();
}

useHotkeys("s", () => handleShortcutS(), { keyup: true });
```

### PR 6 (PLAT-9108) — Prettier 3

Upgrades Prettier 2 → 3 and reformats ~104 files. No lint-rule changes; the
diff is almost entirely trailing commas and line breaks.

## Practical notes for contributors

- `yarn lint` checks; `yarn lint:fix` applies autofixes (both fail on any
  warning).
- The configuration lives in `eslint.config.mjs` at the repository root. Read
  its comments before touching the eslint-config-next / react-hooks plugin
  wiring — the version pinning there is deliberate.
- Lefthook's pre-commit `quality-checks` runs the same `yarn lint` gate, so a
  commit that fails lint locally will also fail CI.
- Per-line `eslint-disable` comments need a justifying comment, and for the
  typed async rules (`no-floating-promises`, `no-misused-promises`,
  `await-thenable`) they are effectively banned: resolve findings semantically
  (await, return, `.catch(reportError(...))`, or `void` only for genuinely
  intentional fire-and-forget with internal rejection handling).
