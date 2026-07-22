# Scene Preview implementation handoff

## Delivered additive behavior

- Added authenticated `/scenes-preview` and exactly one new SPA navigation item,
  **Scenes (Preview)**. It uses the existing `AppLink` and does not alter or
  overwrite the pending Identity navigation work.
- The original `/` Scenes table and `/scene-viewer/[sceneId]` route are
  untouched. Their Viewer, stream-key, deletion, and shareable-URL behavior is
  therefore unchanged.
- The preview table preserves the familiar list filters and cursor paging. A
  row click selects the existing read-only `SceneDrawer` detail sidebar. The
  explicitly labelled, accessible name link is the only preview-table control
  that navigates to `/scene-workspace/<id>`.
- Scene Workspace now has an embedded Viewer panel above its tabs. It
  requests a stream key only after mount from the existing session-authenticated
  `/api/stream-keys` route; credentials remain in component memory and are not
  added to URL, browser storage, visible text, or diagnostic output. The key is
  requested only after `useViewer` has registered the custom elements. Its
  16:9 container supplies a stable non-zero viewport, and the nested
  `VertexViewer` uses the same Emotion `css={{ height: "100%", width: "100%" }}`
  host override as the established full Viewer. This is required because the
  SDK stylesheet otherwise defaults the custom-element host to 300×300.
- Viewer permission and other key-creation failures are non-destructive,
  explicit states; the Workspace remains usable. The raw stream-key handler is
  now exported for the PR #326 Node/MSW harness and correctly maps both SDK
  `Failure` and local `{ message, status }` error envelopes.

## Files

- `src/pages/scenes-preview.tsx`
- `src/components/scene/ScenePreviewTable.tsx`
- `src/components/scene/SceneWorkspaceViewer.tsx`
- `src/components/scene/SceneWorkspace.tsx`
- `src/pages/scene-workspace/[sceneId].tsx`
- `src/components/shared/LeftDrawer.tsx`
- `src/pages/api/stream-keys.ts`

## Coverage

- Browser/MSW: Preview table differentiates row selection from the workspace
  link; embedded viewer verifies authenticated request, key redaction from URL
  and body text, and permission state.
- Node/MSW: exported stream-key handler verifies the exact authenticated SDK
  create request and 403 mapping without Docker or containers.
- Playwright: preview table opens the existing Scene Details sidebar on row
  click and reaches Workspace only through the explicit link; the workspace
  preview verifies the custom-element host has exactly the same desktop bounds
  as its viewport container.

## Viewer SDK alignment

- The SDK globally bundles the required Viewer stylesheet in `src/pages/_app.tsx`.
- The official Viewer component initializes itself when mounted, observes its
  canvas container with `ResizeObserver`, and pauses on disconnect. The preview
  therefore provides a visible, stable container and relies on that lifecycle;
  it does not use the SDK's discouraged `experimentalSkipVisibilityCheck` flag
  or introduce a competing resize observer.
- The full Viewer route remains the implementation reference for custom-element
  registration and host sizing. The additive preview intentionally does not
  import its editing controls or alter its URL credential boundary.

## Verification

- `yarn api:generate:check`: passed.
- `yarn lint`: passed.
- `yarn build`: passed.
- `yarn test --runInBand`: passed (38 suites, 200 tests).
- `node scripts/run-playwright-e2e.mjs e2e/scene-workspace-preview.spec.ts`:
  passed (setup plus Chromium fixture test).
- `git diff --check`: passed.

Run `yarn api:generate:check`, the full Jest suite, and the full Playwright
suite after any concurrent worktree updates before final validation.
