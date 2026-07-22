# Properties & Search — implementation handoff

## Delivered safe scope

This additive developer surface adds `/properties-search` and the persistent
drawer entry **Properties & Search**. It does not modify the existing Viewer
metadata, Scenes, Files, Parts, Documents, or Scene Workspace UX.

### Implemented read paths

1. **Property inspector**

   - `GET /api/property-entries` requires both a non-empty scalar `resourceId`
     and one explicit allowed relationship type: `scene-item`, `part-revision`,
     `part-instance`, or `property-set`.
   - It rejects repeated, missing, empty, invalid-type, and invalid-page input
     before constructing the session Vertex client.
   - UI stays blank until a target is selected; it cannot issue the API's
     account-wide unfiltered list call.

2. **Property key policy list**

   - `GET /api/property-key-policies` uses a server-only
     `propertyKeyPoliciesFromClient` adapter. It creates
     `PropertyKeyPoliciesApi(client.config, undefined, client.axiosInstance)`,
     retaining the session client's OAuth refresh/configuration and never
     extracting credentials or creating a generic raw proxy.
   - The current SDK (`@vertexvis/api-client-node@0.44.0`) facade does not
     expose this API, hence the adapter. A Node/MSW test verifies it sends the
     authenticated configured request.

3. **Search-session monitor**
   - `GET /api/search-sessions/[id]` accepts one non-empty scalar ID and shows
     status after an explicit user action. It does not put API data or secrets
     in the URL.

## Reconnaissance finding and intentional deferrals

The typed 0.44.0 `PropertyKeyPoliciesApi` accepts `FilterExpression` in its
types but serializes it to `filter[suppliedId]=[object Object]`. This was
verified directly with the Node/MSW harness. The UI/route therefore reject
`suppliedId`/`operator` filtering rather than producing a malformed upstream
request. Do not replace the typed adapter with raw Axios to work around this.

The following remain deliberately deferred:

- property entry upsert/removal (requires verified typed-value and null/remove
  semantics);
- property policy filter, create/detail/key entries/delete (requires a fixed
  SDK or an approved typed upstream API client profile plus destructive-flow
  work);
- search-session creation and polling (requires verified expiry range and
  terminal-status contract);

## Files and generated resources

- Manifest entries: `property-entries`, `property-key-policies`,
  `search-sessions` in group `properties-search`.
- Generated routes/clients plus developer-owned lifecycle hooks are under
  `src/lib/resources/properties-search` and `src/pages/api`.
- UI: `src/components/properties-search/PropertiesSearchPage.tsx` and
  `src/pages/properties-search.tsx`.
- Node contracts: `src/__tests__/pages/api/properties-search-contract.test.ts`.

## Validation rework completed

- Both read-only list tabs now exercise returned cursor pagination. `Next page`
  appends the route's `cursor`; `First page` clears it. Loading a new Property
  Entry target atomically resets its cursor.
- `?tab=entries|policies|sessions` opens the matching tab. Tab changes use
  shallow Next router replacement, preserving SPA navigation; invalid values
  retain Entries.
- Policy 403 behavior is covered in both component and deterministic local-only
  Playwright fixtures and remains an error state, never an empty policy list.
- The generator route template now emits Prettier-compatible multiline handler
  creation. `api:generate:check` and scoped Prettier for all three generated
  Properties/Search routes pass together.

## Checks run

- `yarn format`
- `yarn api:generate`
- `yarn api:generate:check`
- `yarn lint`
- `yarn test --selectProjects node --runInBand src/__tests__/pages/api/properties-search-contract.test.ts`
  (4 passing)
- `yarn test --selectProjects browser --runInBand src/__tests__/components/properties-search/PropertiesSearchPage.test.tsx`
  (4 passing)
- `yarn test:e2e --grep "scoped property entries|policy capability failures"`
  (local-only fixture flow, 3 passing including auth setup)
- `yarn build`
- `git diff --check`
- `yarn prettier --check src/pages/api/property-entries.ts src/pages/api/property-key-policies.ts 'src/pages/api/search-sessions/[id].ts'`

No container/Testcontainers test was run or added; this uses the merged PR #326
Node MSW harness.

## Validator checklist

1. Confirm existing Viewer metadata and all existing dashboard navigation are
   unchanged except for the additive drawer link.
2. Run the full Node project with `yarn test --selectProjects node --runInBand`
   and verify the three new routes remain local-handler/MSW tests only.
3. Verify Property Entries never fetches without a complete target; verify
   malformed/repeated filters cause no upstream request.
4. Verify the policy adapter receives only `config` and `axiosInstance` from
   the session client and no client secret/token crosses the browser boundary.
5. Preserve the current filter deferral unless a newer SDK's actual wire
   serialization is verified. Confirm the list cursor reset, policy 403, and
   deep-link tab behavior in the focused component and Playwright suites.
