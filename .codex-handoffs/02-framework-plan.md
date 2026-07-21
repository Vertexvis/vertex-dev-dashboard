# API proxy and client-adapter framework plan

## Decision

Build a small runtime framework for **Pages Router API routes**, then add a checked-in,
deterministic scaffold generator for new Vertex resource groups. Do not attempt to
generate the complete Vertex SDK surface from the SDK or documentation. The SDK is
not a stable enough description of the dashboard's developer-oriented UX: some list
routes require raw JSON:API calls because an SDK method does not yet expose a filter
(`file-collections` is the existing example), and several routes are workflows rather
than a one-to-one API operation (`file-jobs`, merged scenes, scene-view-states).

The generator should create typed route/client _scaffolding_ with a durable extension
module. A developer writes the narrow SDK invocation and any group-specific behaviour
in that extension module. This gives standard lifecycle/error/session behaviour
without hiding Vertex operation semantics or overwriting customization on regeneration.

Do **not** add root `middleware.ts` for these proxies. The present authentication
boundary is `withSession` plus `getClientFromSession`; both require the Node runtime.
The lifecycle hooks below are the requested Next.js server-side middleware equivalent
for Pages Router routes and retain that boundary.

## Evidence and constraints

- There are 21 current session-wrapped API routes under `src/pages/api`; 18 acquire a
  session Vertex client. Most repeat method dispatch, `try/catch`, conversion of a
  `VertexError`, and `getPage` cursor handling.
- Shared conventions already worth retaining: `src/lib/with-session.ts` owns the
  session/client credentials; `src/lib/vertex-api.ts` owns `VertexClient` construction
  and `makeCall`; `src/lib/api.ts` owns public error shapes; `src/lib/paging.ts` owns
  app query-key ordering and cursor UI state; `src/lib/query-filters.ts` formats JSON:API
  filter expressions.
- `src/pages/api/files.ts`, `file-collections.ts`, and `scenes.ts` demonstrate why
  generic list configuration must allow query transformation / raw JSON:API calls.
  Their current raw calls supply filters and/or sparse fields that the SDK does not
  fully model.
- Page components use SWR and expect a non-throwing JSON body such as `ErrorRes` on a
  failed fetch. Preserve that contract; do not globally change the SWR fetcher in
  `src/pages/_app.tsx` as part of this framework.
- The official reference documents cursor pagination and endpoint-specific filters,
  sorting, and JSON:API media types. It also labels several endpoint families preview
  or module-gated. The framework must therefore allow per-resource capability and
  lifecycle overrides instead of assuming CRUD everywhere.

## Target files

Create these framework files:

| File                                                        | Responsibility                                                                                                                                                                                                  |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/api/route.ts`                                      | Route dispatcher, lifecycle types, method dispatch, JSON parsing, common error conversion, session/client context.                                                                                              |
| `src/lib/api/query.ts`                                      | Read a single Next query value, validate required values, parse cursor/page size, apply declarative filters/sort, and expose a `URLSearchParams` builder for raw JSON:API operations.                           |
| `src/lib/api/contracts.ts`                                  | Framework-neutral response/request utility types; re-export or gradually move `Res`, `ErrorRes`, `GetRes`, `DeleteReq` from `src/lib/api.ts` without changing their wire representation.                        |
| `src/lib/api/client.ts`                                     | Browser request helper and typed resource-client factory used by generated client adapters. It returns parsed JSON even on non-2xx so existing `isErrorRes` UI handling continues to work.                      |
| `src/lib/api/generator-types.ts`                            | JSON manifest types and names/path validation shared by the generator's `--check` mode (or duplicated minimally in the `.mjs` script if no TypeScript execution is available).                                  |
| `scripts/generate-api-resource.mjs`                         | Dependency-free Node ESM scaffold generator; reads the manifest, writes only generated files, supports `--resource <name>` and `--check`.                                                                       |
| `api-resources.json`                                        | Checked-in resource manifest: route segment, display name, resource type, supported operation names, and generated client route paths. It is an inventory/scaffold manifest, not an inferred Vertex API schema. |
| `src/lib/resources/<group>/<resource>.client.ts`            | Generated browser adapter. It exports typed query/request contracts, `keys`, and `list/get/create/update/remove` request functions only for declared operations.                                                |
| `src/lib/resources/<group>/<resource>.hooks.ts`             | Generated once, then developer-owned. It declares the lifecycle hook object and operation implementations. The generator never modifies it after creation.                                                      |
| `src/pages/api/<route>.ts` (and `[id].ts` only if declared) | Generated thin default export / named test handler which imports the resource spec and calls `createVertexRoute`.                                                                                               |

Keep existing domain utility modules (`src/lib/files.ts`, `file-collections.ts`,
`scenes.ts`, `part-revisions.ts`, `file-jobs.ts`) where they provide normalization or
workflow helpers. Do not mass-move them into the new resource folder. New groups can
use `src/lib/resources/...`; touched existing groups can migrate only after their
framework parity tests pass.

## Runtime design

### Stable wire types

Keep the existing public shapes exactly:

```ts
export interface Res {
  readonly status: number;
}
export interface ErrorRes extends Res {
  readonly message: string;
}
export interface GetRes<T> extends Res {
  readonly cursors: Cursors;
  readonly data: T[];
}
export type RouteResult<T extends Res> = T;
```

`createVertexRoute` sends `res.status(result.status).json(result)` for both success and
failure. Existing consumers consequently continue to use `isErrorRes(data)` and no
client-wide response-semantic migration is required.

### Route context and hook contract

Implement in `src/lib/api/route.ts`:

```ts
export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export interface RouteContext<
  TInput = unknown,
  TQuery = Record<string, unknown>
> {
  readonly req: NextIronRequest;
  readonly res: NextApiResponse;
  readonly client: VertexClient;
  readonly method: HttpMethod;
  readonly path: Readonly<Record<string, string | undefined>>;
  readonly query: TQuery;
  readonly input: TInput;
}

export type HookResult<T extends Res> = void | T;
export interface RouteHooks<TInput, TQuery, TResult extends Res> {
  beforeRequest?(
    ctx: RouteContext<TInput, TQuery>
  ): Promise<HookResult<TResult>>;
  beforeValidate?(
    ctx: RouteContext<TInput, TQuery>
  ): Promise<HookResult<TResult>>;
  validate?(ctx: RouteContext<TInput, TQuery>): Promise<HookResult<TResult>>;
  transformQuery?(ctx: RouteContext<TInput, TQuery>): Promise<TQuery> | TQuery;
  transformInput?(ctx: RouteContext<TInput, TQuery>): Promise<TInput> | TInput;
  beforeCall?(ctx: RouteContext<TInput, TQuery>): Promise<HookResult<TResult>>;
  afterCall?(
    ctx: RouteContext<TInput, TQuery>,
    result: TResult
  ): Promise<TResult>;
  afterResponse?(
    ctx: RouteContext<TInput, TQuery>,
    result: TResult
  ): Promise<void>;
  onError?(
    ctx: Partial<RouteContext<TInput, TQuery>>,
    error: unknown
  ): Promise<ErrorRes | undefined>;
}

export interface RouteOperation<TInput, TQuery, TResult extends Res> {
  readonly parse?: (req: NextIronRequest) => TInput | ErrorRes;
  readonly query?: (req: NextIronRequest) => TQuery | ErrorRes;
  readonly execute: (ctx: RouteContext<TInput, TQuery>) => Promise<TResult>;
}

export interface VertexRouteSpec<TResult extends Res> {
  readonly hooks?: RouteHooks<unknown, unknown, TResult>;
  readonly operations: Partial<
    Record<HttpMethod, RouteOperation<unknown, unknown, TResult>>
  >;
}
```

Implementation order is: reject unsupported method (405) -> construct client from
session -> parse route/query/body -> `beforeRequest` -> `beforeValidate` -> `validate`
-> transform query/body -> `beforeCall` -> `execute` -> `afterCall` -> serialize ->
`afterResponse`. Any hook may short-circuit by returning an `ErrorRes` or a normal
`Res`. `onError` runs once around the lifecycle and defaults to common Vertex/Axios
failure conversion. Do not let an `afterResponse` failure replace an already-sent
success; log it.

The concrete implementation can make generic types local to `createVertexRoute` so a
resource spec keeps its own `TInput/TQuery/TResult`; do not force all generated
resources through `unknown` at call sites. The abbreviated `VertexRouteSpec` above is
only the runtime registry shape.

Required helpers:

```ts
export function parseJsonBody<T>(body: unknown): T | ErrorRes;
export function requiredPathParam(req: NextIronRequest, name: string, label?: string): string | ErrorRes;
export function toRouteError(error: unknown): ErrorRes;
export function createVertexRoute<TInput, TQuery, TResult extends Res>(spec: ...): Handler<NextApiRequest, NextApiResponse>;
```

`parseJsonBody` must accept Next's object body _and_ a JSON string, return `BodyRequired`
for nullish/empty input, and return `InvalidBody` for malformed JSON. This fixes the
current unsafe `JSON.parse(req.body)`-before-presence-check pattern only in migrated/new
routes. `toRouteError` should preserve a structured Vertex/Axios `Failure` status/title
via `toErrorRes`, otherwise use `ServerError` and `logError`. Do not disclose thrown
validation/internal error text.

### Query template and specialization points

Implement `src/lib/api/query.ts` with a declarative common base:

```ts
export interface ListQuery {
  readonly cursor?: string;
  readonly pageSize: number;
  readonly sort?: string;
}
export interface FilterBinding {
  readonly requestName: string; // dashboard query key, e.g. createdAtStart
  readonly vertexField: string; // e.g. createdAt
  readonly operation: keyof FilterExpression; // gte, contains, eq, ...
}
export interface ListQuerySpec {
  readonly defaultPageSize: number;
  readonly maxPageSize?: number;
  readonly filters?: readonly FilterBinding[];
  readonly sortable?: readonly string[];
  readonly transform?: (params: URLSearchParams, req: NextIronRequest) => void;
}
export function parseListQuery(
  req: NextIronRequest,
  spec: ListQuerySpec
): ListQuery;
export function toVertexListParams(
  query: ListQuery,
  spec: ListQuerySpec
): URLSearchParams;
```

`transform` is intentional: it supports sparse fields and the special cases the API
definition/SDK cannot express. A resource hook can also replace the whole query parser
for APIs whose input is not a normal list. Sorting must be allowlisted by a resource's
declared sortable fields rather than forwarded arbitrarily. Clamp page size to a modest
configurable maximum after retaining current defaults (normally 10; 200 only for the
queued-job aggregate workflow).

For SDK-supported calls, `execute` maps this normalized query to the SDK method's typed
request. For SDK gaps, use `toVertexListParams` with `client.axiosInstance` and the
existing bearer/JSON:API headers; keep that raw call inside the resource hook/operation,
not the generic dispatcher.

### Browser client adapters

`src/lib/api/client.ts` should expose:

```ts
export async function requestJson<T>(path: string, init?: RequestInit): Promise<T>;
export function createResourceClient<TList, TListQuery, TCreate, TUpdate>(spec: {
  readonly path: string;
  readonly supports: readonly ("list" | "get" | "create" | "update" | "remove")[];
}): { readonly keys: ...; readonly list?: ...; /* declared operations only */ };
```

Generated `keys.list(query)` must use the existing `buildQuery` (or extract its pure
ordering function without changing output) so SWR cache keys remain stable. Generated
mutations call `requestJson`, set `Content-Type: application/json` only when sending a
body, and return the route's typed response. The adapter is deliberately a thin request
layer; it does not own UI state, React hooks, tables, or automatic invalidation.

Move types currently imported from `src/pages/api/*` (for example `CreateFileReq`,
`CreateSceneReq`, `UpdateSceneReq`, `CreatePartReq`) into their resource client/contract
module when their corresponding group is migrated, then update component imports. Route
modules must not be treated as the stable client contract for new work.

## Generator and manifest

Use `scripts/generate-api-resource.mjs` so it runs with the project's existing Node
tooling and adds no dependency. Suggested commands:

```sh
node scripts/generate-api-resource.mjs --resource documents
node scripts/generate-api-resource.mjs --check
```

Add `api:generate` and `api:generate:check` scripts to `package.json` using those
commands. The CI/test workflow should run the check command after generation is adopted.

An entry in `api-resources.json` should look like:

```json
{
  "name": "documents",
  "group": "data-management",
  "displayName": "Documents",
  "route": "documents",
  "resourceType": "document",
  "operations": ["list", "get", "create"],
  "list": { "defaultPageSize": 10, "filters": ["suppliedId"] }
}
```

The generator validates a slug, rejects a route outside `src/pages/api`, and only owns
files with a `// GENERATED by generate-api-resource.mjs; DO NOT EDIT` header:

- `src/pages/api/<route>.ts` (or `<route>/[id].ts` when selected),
- `src/lib/resources/<group>/<resource>.client.ts`, and
- a colocated generated `*.route.ts` spec if that makes the page route thinner.

It creates `<resource>.hooks.ts` only when absent, tagged `// developer-owned`; it must
never overwrite that file. `--check` renders generated output in memory and exits
non-zero on drift, listing affected paths. Template values are identifiers/JSON data,
not arbitrary code fragments. Group-specific SDK calls live in the developer-owned hook
file, which is precisely where lifecycle overrides stay safe on regeneration.

The manifest should record the official documentation grouping/Postman folder selected
by the API-inventory planner, plus `preview`/`moduleGated` metadata for navigation/UX
work. It is not permission to surface every endpoint automatically.

## First migration and implementation order

1. Add the framework and unit tests without changing existing routes.
2. Add generator, a single non-production manifest fixture/sample, generated-output
   `--check` test, and package scripts. Confirm a second run is byte-identical.
3. Migrate **Files** as the proving resource because it exercises list filters, sort,
   raw JSON:API fallback, create, delete, download URL, client adapter, and existing
   route tests. Preserve `/api/files` URL and response JSON exactly.
4. Migrate **File collections** next; keep its export-readiness aggregation as a
   developer-owned `afterCall`/custom GET operation, not a generic list option.
5. Migrate **Scenes/parts** only after the first two groups pass; preserve their
   multi-call create/merge/commit workflows in custom operation hooks.
6. New API groups use the generator from their first implementation. The grouping
   planner adds manifest entries as it schedules groups. Do not mechanically rewrite
   all current route files in the framework PR.

## Test plan and acceptance criteria

Add node-environment unit tests for the framework (using an in-memory request/response
and a mocked client), covering:

- 405 and supported method dispatch; handler remains session-wrapped.
- empty/malformed/object JSON body parsing; no uncaught `JSON.parse` error.
- hook ordering; a validation short circuit makes no SDK call.
- query/body transformation reaches `execute`; `afterCall` transforms response;
  `afterResponse` does not alter a sent success.
- Vertex `Failure`, Axios failure, unknown exception, and custom `onError` map to the
  established `ErrorRes` status/message shape.
- cursor/default/clamped page size, filter encoding, allowlisted and rejected sort,
  and raw-query transform behavior.
- generated browser key determinism and request method/body/header behavior.
- generator idempotence and `--check` detects an edited generated file while preserving
  a developer-owned hooks file.

For each migrated resource, retain/expand its MockServer contract tests. Assert exact
upstream path, JSON:API query parameters, payload body, authorization/media headers
where the raw path is used, returned status/body, and no upstream call for invalid input.
Retain the existing Files and File Collections tests as regression baselines, changing
only imports if handler exports move.

Run `yarn format`, `yarn lint`, `yarn test`, `yarn api:generate:check`, and `yarn build`.
The validator agent should additionally exercise the migrated Files and File Collections
views with Playwright using a controlled mock/fixture login; do not require real Vertex
credentials in CI. It should verify filtering, sort (Files), pagination, create/delete
feedback, and error rendering.

## Scope boundaries / risks

- This is an internal authenticated proxy, not a public generic REST proxy. Never add a
  client-controlled Vertex URL, resource name, arbitrary method, or arbitrary headers.
- Do not put client secrets or SDK tokens in generated browser code; browser adapters
  call same-origin `/api/...` only.
- Do not infer unsupported SDK endpoints or request schemas from endpoint names. Each
  resource's hooks must use the installed SDK's actual types/methods and the official
  reference before implementation.
- Do not equate endpoint breadth with a CRUD UI. Async, preview, module-gated,
  destructive, and relationship endpoints require a UX researcher/planner decision and
  a custom hook/operation where appropriate.
- Do not change response status semantics, session refresh, current routes, or root
  Next middleware as part of framework introduction. Those are separate, high-risk
  migrations.
- The main risk is over-generalization. Keep the generic layer limited to transport,
  lifecycle, parsing, error normalization, and common list query encoding. Keep
  workflow/business behavior in resource hooks.

## Handoff for implementation agent

Start by implementing `route.ts` and its tests, followed by `query.ts`, then the
generator/client adapter. Use Files as the first real generated/migrated resource only
after the common tests pass. Preserve named exports (`handleFiles`, `handleFileCollections`)
or provide equivalent testable named handlers so current MockServer tests stay direct.
When a feature needs specialized filtering, sorting, sparse fields, request shaping, or
multi-call behavior, add it to the resource's `*.hooks.ts`; do not add conditional
branches to `createVertexRoute`.
