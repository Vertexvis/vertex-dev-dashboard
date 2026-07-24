import { makeSortParser, parseAsPageIndex } from "../../lib/nuqs-table-state";

describe("nuqs-table-state", () => {
  describe("parseAsPageIndex", () => {
    it("parses non-negative integers", () => {
      expect(parseAsPageIndex.parse("0")).toBe(0);
      expect(parseAsPageIndex.parse("12")).toBe(12);
    });

    it("returns null for malformed values so the default applies", () => {
      expect(parseAsPageIndex.parse("-1")).toBeNull();
      expect(parseAsPageIndex.parse("not-a-page")).toBeNull();
    });
  });

  describe("makeSortParser", () => {
    const parser = makeSortParser({
      "-created": { field: "created", order: "desc" },
      created: { field: "created", order: "asc" },
    });

    it("parses known API sort parameter values", () => {
      expect(parser.parse("created")).toEqual({
        field: "created",
        order: "asc",
      });
      expect(parser.parse("-created")).toEqual({
        field: "created",
        order: "desc",
      });
    });

    it("returns null for unknown values so the default applies", () => {
      expect(parser.parse("unsupported")).toBeNull();
      expect(parser.parse("")).toBeNull();
    });

    it("serializes back to the API sort parameter", () => {
      expect(parser.serialize({ field: "created", order: "desc" })).toBe(
        "-created"
      );
      expect(parser.serialize({ field: "created", order: "asc" })).toBe(
        "created"
      );
    });

    it("treats equivalent sort states as equal for default elision", () => {
      expect(
        parser.eq?.(
          { field: "created", order: "desc" },
          { field: "created", order: "desc" }
        )
      ).toBe(true);
      expect(
        parser.eq?.(
          { field: "created", order: "desc" },
          { field: "name", order: "desc" }
        )
      ).toBe(false);
    });
  });
});
