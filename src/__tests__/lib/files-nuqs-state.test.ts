import {
  DefaultFileSort,
  parseAsFileSort,
  parseAsPageIndex,
} from "../../lib/files-nuqs-state";

describe("files-nuqs-state", () => {
  describe("parseAsFileSort", () => {
    it("parses API sort parameter values", () => {
      expect(parseAsFileSort.parse("name")).toEqual({
        field: "name",
        order: "asc",
      });
      expect(parseAsFileSort.parse("-name")).toEqual({
        field: "name",
        order: "desc",
      });
      expect(parseAsFileSort.parse("created")).toEqual({
        field: "created",
        order: "asc",
      });
      expect(parseAsFileSort.parse("-created")).toEqual(DefaultFileSort);
    });

    it("returns null for unknown values so the default applies", () => {
      expect(parseAsFileSort.parse("unsupported")).toBeNull();
      expect(parseAsFileSort.parse("")).toBeNull();
    });

    it("serializes back to the API sort parameter", () => {
      expect(
        parseAsFileSort.serialize({ field: "name", order: "desc" })
      ).toBe("-name");
      expect(parseAsFileSort.serialize(DefaultFileSort)).toBe("-created");
    });

    it("treats equivalent sort states as equal for default elision", () => {
      expect(
        parseAsFileSort.eq(DefaultFileSort, {
          field: "created",
          order: "desc",
        })
      ).toBe(true);
      expect(
        parseAsFileSort.eq(DefaultFileSort, { field: "name", order: "desc" })
      ).toBe(false);
    });
  });

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
});
