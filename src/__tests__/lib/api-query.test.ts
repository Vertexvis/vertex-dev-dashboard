import { parseListQuery, toVertexListParams } from "../../lib/api/query";
import { NextIronRequest } from "../../lib/with-session";

function request(query: Record<string, string | string[]>): NextIronRequest {
  return { query } as NextIronRequest;
}

describe("list query framework", () => {
  const spec = {
    defaultPageSize: 10,
    filters: [
      {
        operation: "contains" as const,
        requestName: "name",
        vertexField: "name",
      },
      {
        operation: "gte" as const,
        requestName: "from",
        vertexField: "createdAt",
      },
    ],
    maxPageSize: 25,
    sortable: ["created", "name"],
  };

  it("normalizes cursors, filters, allowlisted sorting, and page-size bounds", () => {
    const parsed = parseListQuery(
      request({
        cursor: "next",
        from: "2026-01-01",
        name: "fixture",
        pageSize: "200",
        sort: "-created",
      }),
      spec
    );
    expect("message" in parsed).toBe(false);
    if ("message" in parsed) return;

    expect(parsed).toEqual({
      cursor: "next",
      filters: {
        createdAt: { gte: "2026-01-01" },
        name: { contains: "fixture" },
      },
      pageSize: 25,
      sort: "-created",
    });
    expect(toVertexListParams(parsed, spec).toString()).toBe(
      "page%5Bcursor%5D=next&page%5Bsize%5D=25&sort=-created&filter%5Bname%5D%5Bcontains%5D=fixture&filter%5BcreatedAt%5D%5Bgte%5D=2026-01-01"
    );
  });

  it("rejects sort fields which have not been declared by the resource", () => {
    expect(parseListQuery(request({ sort: "untrusted" }), spec)).toEqual({
      message: "Invalid sort.",
      status: 400,
    });
  });
});
