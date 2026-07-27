import {
  PropertyKeyPolicyMode,
  PropertyKeyPolicyResource,
  sortPropertyKeyPolicies,
  toPropertyKeyPolicy,
  toPropertyKeyPolicyEntry,
  toPropertyKeyPolicyPage,
} from "../../lib/property-key-policies";

function policy(
  overrides: Partial<{
    id: string;
    name?: string;
    suppliedId?: string;
    createdAt: string;
    mode: PropertyKeyPolicyMode;
  }> = {}
): PropertyKeyPolicyResource {
  return {
    type: "property-key-policy",
    id: overrides.id ?? "policy-id",
    attributes: {
      createdAt: overrides.createdAt ?? "2026-06-10T15:30:00Z",
      mode: overrides.mode ?? PropertyKeyPolicyMode.Allowlist,
      name: "name" in overrides ? overrides.name : "Allow policy",
      suppliedId: "suppliedId" in overrides ? overrides.suppliedId : "plm-123",
    },
  };
}

describe("property key policy converters", () => {
  it("maps a policy resource into a dashboard model", () => {
    const model = toPropertyKeyPolicy(
      policy({
        id: "policy-id",
        name: "Allow policy",
        suppliedId: "plm-123",
        createdAt: "2026-06-10T15:30:00Z",
        mode: PropertyKeyPolicyMode.Allowlist,
      })
    );

    expect(model).toEqual({
      id: "policy-id",
      name: "Allow policy",
      suppliedId: "plm-123",
      createdAt: "2026-06-10T15:30:00Z",
      mode: "allowlist",
    });
  });

  it("maps a page of policies into dashboard rows", () => {
    const page = toPropertyKeyPolicyPage({
      cursors: { self: "self", next: "next" },
      data: [
        policy({
          id: "policy-id",
          name: "Deny policy",
          suppliedId: "plm-456",
          createdAt: "2026-06-10T15:30:00Z",
          mode: PropertyKeyPolicyMode.Denylist,
        }),
      ],
      status: 200,
    });

    expect(page).toEqual({
      cursors: { self: "self", next: "next" },
      items: [
        {
          id: "policy-id",
          name: "Deny policy",
          suppliedId: "plm-456",
          createdAt: "2026-06-10T15:30:00Z",
          mode: "denylist",
        },
      ],
    });
  });

  it("maps an entry resource into a dashboard entry preserving key case", () => {
    const entry = toPropertyKeyPolicyEntry({
      type: "property-key-policy-entry",
      id: "entry-id",
      attributes: { key: { name: "MixedCaseKey" } },
      relationships: {
        propertyKeyPolicy: {
          data: { type: "property-key-policy", id: "policy-id" },
        },
      },
    });

    expect(entry).toEqual({ id: "entry-id", name: "MixedCaseKey" });
  });
});

describe("sortPropertyKeyPolicies", () => {
  const bravo = policy({ id: "b", name: "Bravo", createdAt: "2026-01-02" });
  const alpha = policy({ id: "a", name: "Alpha", createdAt: "2026-01-03" });
  const charlie = policy({ id: "c", name: "Charlie", createdAt: "2026-01-01" });
  const unsorted = [bravo, alpha, charlie];

  it("returns the input unchanged when no sort is provided", () => {
    expect(sortPropertyKeyPolicies(unsorted)).toBe(unsorted);
  });

  it("returns the input unchanged for an unknown sort field", () => {
    expect(sortPropertyKeyPolicies(unsorted, "mode")).toBe(unsorted);
  });

  it("sorts by name ascending", () => {
    expect(sortPropertyKeyPolicies(unsorted, "name").map((p) => p.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("sorts by name descending", () => {
    expect(sortPropertyKeyPolicies(unsorted, "-name").map((p) => p.id)).toEqual(
      ["c", "b", "a"]
    );
  });

  it("sorts by created ascending", () => {
    expect(
      sortPropertyKeyPolicies(unsorted, "created").map((p) => p.id)
    ).toEqual(["c", "b", "a"]);
  });

  it("sorts by created descending", () => {
    expect(
      sortPropertyKeyPolicies(unsorted, "-created").map((p) => p.id)
    ).toEqual(["a", "b", "c"]);
  });

  it("treats a missing name as an empty string when sorting", () => {
    const named = policy({ id: "named", name: "Alpha" });
    const missing = policy({ id: "missing", name: undefined });

    expect(
      sortPropertyKeyPolicies([named, missing], "name").map((p) => p.id)
    ).toEqual(["missing", "named"]);
  });

  it("does not mutate the input array", () => {
    const input = [bravo, alpha, charlie];
    sortPropertyKeyPolicies(input, "name");

    expect(input.map((p) => p.id)).toEqual(["b", "a", "c"]);
  });
});
