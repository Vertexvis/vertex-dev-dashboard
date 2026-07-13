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

  it("filters collections by case-insensitive partial name and supplied ID", () => {
    const collections = [
      {
        type: "file-collection" as const,
        id: "collection-1",
        attributes: {
          name: "Engine Assembly",
          suppliedId: "PLM-123",
          created: "2026-06-10T15:30:00Z",
        },
      },
      {
        type: "file-collection" as const,
        id: "collection-2",
        attributes: {
          name: "Cabin Assembly",
          suppliedId: "PLM-456",
          created: "2026-06-11T15:30:00Z",
        },
      },
    ];

    expect(
      filterFileCollections(collections, {
        name: "ENGINE",
        suppliedId: "m-12",
      })
    ).toEqual([collections[0]]);
    expect(filterFileCollections(collections, { name: "missing" })).toEqual([]);
  });
});
