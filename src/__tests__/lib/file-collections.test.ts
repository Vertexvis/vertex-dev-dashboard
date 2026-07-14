import {
  filterFileCollections,
  toFileCollection,
  toFileCollectionPage,
} from "../../lib/file-collections";

describe("file collection paging", () => {
  it("maps file collection metadata into a dashboard detail model", () => {
    const collection = toFileCollection({
      type: "file-collection",
      id: "collection-id",
      attributes: {
        name: "Assembly",
        suppliedId: "plm-123",
        created: "2026-06-10T15:30:00Z",
        expiresAt: "2026-07-10T15:30:00Z",
        metadata: { source: "unit-test" },
      },
    });

    expect(collection).toEqual({
      id: "collection-id",
      name: "Assembly",
      suppliedId: "plm-123",
      created: "2026-06-10T15:30:00Z",
      expiresAt: "2026-07-10T15:30:00Z",
      metadata: { source: "unit-test" },
    });
  });

  it("maps file collection metadata into dashboard rows", () => {
    const page = toFileCollectionPage({
      cursors: { self: "self", next: "next" },
      data: [
        {
          type: "file-collection",
          id: "collection-id",
          attributes: {
            name: "Assembly",
            suppliedId: "plm-123",
            created: "2026-06-10T15:30:00Z",
            expiresAt: "2026-07-10T15:30:00Z",
            metadata: { source: "unit-test" },
          },
        },
      ],
      status: 200,
    });

    expect(page).toEqual({
      cursors: { self: "self", next: "next" },
      items: [
        {
          id: "collection-id",
          name: "Assembly",
          suppliedId: "plm-123",
          created: "2026-06-10T15:30:00Z",
          expiresAt: "2026-07-10T15:30:00Z",
          metadata: { source: "unit-test" },
        },
      ],
    });
  });

  it("filters collections inclusively by creation time", () => {
    const collections = [
      {
        type: "file-collection" as const,
        id: "collection-1",
        attributes: {
          name: "Created first",
          suppliedId: "first",
          created: "2026-06-10T23:59:59.999Z",
        },
      },
      {
        type: "file-collection" as const,
        id: "collection-2",
        attributes: {
          name: "Created second",
          suppliedId: "second",
          created: "2026-06-11T00:00:00.000Z",
        },
      },
    ];

    expect(
      filterFileCollections(collections, {
        createdAtEnd: "2026-06-10T23:59:59.999Z",
        createdAtStart: "2026-06-10T00:00:00.000Z",
      })
    ).toEqual([collections[0]]);
  });
});
