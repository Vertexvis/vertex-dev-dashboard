import { toFileCollectionPage } from "./file-collections";

describe("file collection paging", () => {
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
});
