/**
 * @jest-environment node
 */
import { spawnSync } from "child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";

const generator = resolve(process.cwd(), "scripts/generate-api-resource.mjs");
const temporaryRoots: string[] = [];

function createRoot(resources: unknown[]): string {
  const root = mkdtempSync(join(tmpdir(), "vertex-api-resource-generator-"));
  temporaryRoots.push(root);
  writeFileSync(root + "/api-resources.json", JSON.stringify({ resources }));
  return root;
}

function run(root: string, ...args: string[]) {
  return spawnSync(process.execPath, [generator, ...args], {
    encoding: "utf8",
    env: { ...process.env, API_RESOURCE_ROOT: root },
  });
}

function resource(overrides: Record<string, unknown> = {}) {
  return {
    displayName: 'Widgets "quoted"',
    group: "test-group",
    name: "widgets",
    operations: ["list", "get", "create", "update", "remove"],
    resourceType: "widget",
    route: "widgets",
    ...overrides,
  };
}

afterEach(() => {
  temporaryRoots
    .splice(0)
    .forEach((root) => rmSync(root, { force: true, recursive: true }));
});

describe("API resource generator", () => {
  it("generates separate collection/detail handlers and safely serializes display names", () => {
    const root = createRoot([resource()]);

    expect(run(root).status).toBe(0);
    const collection = readFileSync(
      join(root, "src/pages/api/widgets.ts"),
      "utf8"
    );
    const detail = readFileSync(
      join(root, "src/pages/api/widgets/[id].ts"),
      "utf8"
    );
    const hooks = readFileSync(
      join(root, "src/lib/resources/test-group/widgets.hooks.ts"),
      "utf8"
    );

    expect(collection).toContain("widgetsCollectionRouteSpec");
    expect(detail).toContain("widgetsDetailRouteSpec");
    expect(hooks).toContain("GET: { execute");
    expect(hooks).toContain("POST: { execute");
    expect(hooks).toContain("PATCH: { parse: parseDetailPath");
    expect(hooks).toContain("DELETE: { parse: parseDetailPath");
    expect(hooks).toContain(
      'message: "Widgets \\"quoted\\" is not implemented."'
    );
  });

  it("preserves developer-owned hooks and detects generated drift", () => {
    const root = createRoot([resource()]);
    expect(run(root).status).toBe(0);
    const client = join(root, "src/lib/resources/test-group/widgets.client.ts");
    const hooks = join(root, "src/lib/resources/test-group/widgets.hooks.ts");
    writeFileSync(client, `${readFileSync(client, "utf8")}\n// drift\n`);
    writeFileSync(
      hooks,
      `${readFileSync(hooks, "utf8")}\n// developer override\n`
    );

    expect(run(root, "--check").status).toBe(1);
    expect(run(root).status).toBe(0);
    expect(readFileSync(hooks, "utf8")).toContain("// developer override");
    expect(run(root, "--check").status).toBe(0);
  });

  it("refuses non-generated targets and duplicate paths before modifying files", () => {
    const root = createRoot([resource()]);
    const client = join(root, "src/lib/resources/test-group/widgets.client.ts");
    mkdirSync(join(root, "src/lib/resources/test-group"), { recursive: true });
    writeFileSync(client, "// developer-owned\n");

    const refusal = run(root);
    expect(refusal.status).toBe(1);
    expect(refusal.stderr).toContain(
      "Refusing to overwrite non-generated file"
    );
    expect(readFileSync(client, "utf8")).toBe("// developer-owned\n");

    const duplicateRoot = createRoot([
      resource(),
      resource({ name: "other-widgets" }),
    ]);
    const duplicate = run(duplicateRoot);
    expect(duplicate.status).toBe(1);
    expect(duplicate.stderr).toContain("Duplicate route: widgets");
    expect(() =>
      readFileSync(join(duplicateRoot, "src/pages/api/widgets.ts"))
    ).toThrow();
  });
});
