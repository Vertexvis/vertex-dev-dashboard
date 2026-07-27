import { vertexvis } from "@vertexvis/frame-streaming-protos";
import { DomainPropertyEntry } from "@vertexvis/viewer";

import { toMetadata, toMetadataFromDomainEntries } from "../../lib/metadata";

function stringEntry(
  id: string,
  name: string,
  value: string
): DomainPropertyEntry {
  return {
    id,
    key: { name, category: 0 },
    value: { type: "string", value },
  } as unknown as DomainPropertyEntry;
}

describe("toMetadataFromDomainEntries", () => {
  // Policy enforcement is the backend's job: `listSceneItemMetadata` streams an
  // already-filtered entry set. These tests assert the mapper faithfully
  // reflects exactly what it receives (and never injects excluded keys), plus
  // case-sensitivity — by comparing an UNFILTERED set against a FILTERED one.
  it("reflects exactly the entries returned (Allow/Deny filtering)", () => {
    // Unfiltered stream: "Cost" is present.
    const unfiltered: DomainPropertyEntry[] = [
      stringEntry("1", "Material", "Steel"),
      stringEntry("2", "Cost", "100"),
      stringEntry("3", "Weight", "12kg"),
    ];
    // Backend-filtered stream (e.g. denylist removed "Cost", or allowlist
    // excluded it): the same set minus "Cost".
    const filtered: DomainPropertyEntry[] = [
      stringEntry("1", "Material", "Steel"),
      stringEntry("3", "Weight", "12kg"),
    ];

    const unfilteredMd = toMetadataFromDomainEntries(unfiltered);
    const filteredMd = toMetadataFromDomainEntries(filtered);

    // "Cost" appears iff the backend included it — the mapper adds nothing.
    expect(unfilteredMd.properties.Cost).toBe("100");
    expect(unfilteredMd.properties).toHaveProperty("Cost");
    expect(filteredMd.properties).not.toHaveProperty("Cost");
    expect(Object.keys(filteredMd.properties)).toEqual(["Material", "Weight"]);
  });

  it("does not resurrect a filtered key via case-folding", () => {
    // Case-sensitivity: a lowercase "cost" surviving the filter must NOT be
    // treated as the excluded "Cost".
    const filtered: DomainPropertyEntry[] = [
      stringEntry("1", "Material", "Steel"),
      stringEntry("2", "cost", "hidden-lowercase"),
    ];

    const md = toMetadataFromDomainEntries(filtered);

    expect(md.properties).not.toHaveProperty("Cost");
    expect(md.properties.cost).toBe("hidden-lowercase");
  });

  it("preserves property keys verbatim and case-sensitively", () => {
    const entries: DomainPropertyEntry[] = [
      stringEntry("1", "Material", "Steel"),
      stringEntry("2", "material", "aluminum"),
    ];

    const md = toMetadataFromDomainEntries(entries);

    // "Material" and "material" are distinct keys — neither normalized.
    expect(md.properties.Material).toBe("Steel");
    expect(md.properties.material).toBe("aluminum");
    expect(Object.keys(md.properties)).toContain("Material");
    expect(Object.keys(md.properties)).toContain("material");
  });

  it("returns empty properties for empty entries", () => {
    const md = toMetadataFromDomainEntries([]);

    expect(md.properties).toEqual({});
    expect(Object.keys(md.properties)).toHaveLength(0);
  });

  it("merges synthetic identifier keys from the identifiers arg", () => {
    const entries: DomainPropertyEntry[] = [
      stringEntry("1", "Material", "Steel"),
    ];

    const md = toMetadataFromDomainEntries(entries, {
      id: "item-uuid",
      suppliedId: "supplied-1",
      name: "Bracket",
      partId: "part-1",
      partRevisionId: "rev-1",
      partRevisionSuppliedId: "rev-supplied-1",
    });

    expect(md.partName).toBe("Bracket");
    expect(md.properties.VERTEX_SCENE_ITEM_ID).toBe("item-uuid");
    expect(md.properties.VERTEX_SCENE_ITEM_SUPPLIED_ID).toBe("supplied-1");
    expect(md.properties.VERTEX_PART_ID).toBe("part-1");
    expect(md.properties.VERTEX_PART_REVISION_ID).toBe("rev-1");
    expect(md.properties.VERTEX_PART_REVISION_SUPPLIED_ID).toBe(
      "rev-supplied-1"
    );
    expect(md.properties.Material).toBe("Steel");
  });

  it("formats long, double, and timestamp values", () => {
    const entries: DomainPropertyEntry[] = [
      {
        id: "1",
        key: { name: "Count", category: 0 },
        value: { type: "long", value: 42 },
      },
      {
        id: "2",
        key: { name: "Ratio", category: 0 },
        value: { type: "double", value: 3.5 },
      },
      {
        id: "3",
        key: { name: "Created", category: 0 },
        value: { type: "timestamp", value: { seconds: 0, nanos: 0 } },
      },
    ] as unknown as DomainPropertyEntry[];

    const md = toMetadataFromDomainEntries(entries);

    expect(md.properties.Count).toBe("42");
    expect(md.properties.Ratio).toBe("3.5");
    expect(md.properties.Created).toBe("1970-01-01T00:00:00.000Z");
  });

  it("alphabetizes the resulting keys", () => {
    const entries: DomainPropertyEntry[] = [
      stringEntry("1", "Zeta", "z"),
      stringEntry("2", "Alpha", "a"),
      stringEntry("3", "Mu", "m"),
    ];

    const md = toMetadataFromDomainEntries(entries);

    expect(Object.keys(md.properties)).toEqual(["Alpha", "Mu", "Zeta"]);
  });
});

describe("toMetadata (stream hit)", () => {
  it("returns undefined when the hit is missing", () => {
    expect(toMetadata({ hit: undefined })).toBeUndefined();
    expect(toMetadata({ hit: null })).toBeUndefined();
  });

  it("maps stream metadataProperties (case-sensitive) and identifier keys", () => {
    const hit = {
      itemId: { hex: "item-uuid" },
      itemSuppliedId: { value: "supplied-1" },
      partId: { hex: "part-1" },
      partRevisionId: { hex: "rev-1" },
      suppliedPartRevisionId: { value: "rev-supplied-1" },
      metadataProperties: [
        { key: "Material", asString: "Steel" },
        { key: "material", asString: "aluminum" },
        { key: "Count", asLong: 42 },
      ],
    } as unknown as vertexvis.protobuf.stream.IHit;

    const md = toMetadata({ hit });

    // Stream metadata properties are mapped verbatim, case-sensitively.
    expect(md?.properties.Material).toBe("Steel");
    expect(md?.properties.material).toBe("aluminum");
    expect(md?.properties.Count).toBe("42");

    // Synthetic identifier keys are surfaced for parity.
    expect(md?.properties.VERTEX_SCENE_ITEM_ID).toBe("item-uuid");
    expect(md?.properties.VERTEX_SCENE_ITEM_SUPPLIED_ID).toBe("supplied-1");
    expect(md?.properties.VERTEX_PART_ID).toBe("part-1");
    expect(md?.properties.VERTEX_PART_REVISION_ID).toBe("rev-1");
    expect(md?.properties.VERTEX_PART_REVISION_SUPPLIED_ID).toBe(
      "rev-supplied-1"
    );
  });

  it("reflects exactly the stream properties returned (no injected keys)", () => {
    const hit = {
      itemId: { hex: "item-uuid" },
      metadataProperties: [
        { key: "Material", asString: "Steel" },
        { key: "Weight", asString: "12kg" },
      ],
    } as unknown as vertexvis.protobuf.stream.IHit;

    const md = toMetadata({ hit });

    expect(md?.properties).toHaveProperty("Material");
    expect(md?.properties).toHaveProperty("Weight");
    // The stream did not include "Cost"; the mapper adds nothing.
    expect(md?.properties).not.toHaveProperty("Cost");
  });
});
