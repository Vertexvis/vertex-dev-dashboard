import { parsePositiveQueryInt } from "../../lib/query-params";

describe("parsePositiveQueryInt", () => {
  it("returns parsed integer values", () => {
    expect(parsePositiveQueryInt("25", 10)).toBe(25);
  });

  it("returns the default for missing or blank values", () => {
    expect(parsePositiveQueryInt(undefined, 10)).toBe(10);
    expect(parsePositiveQueryInt("", 10)).toBe(10);
    expect(parsePositiveQueryInt("   ", 10)).toBe(10);
  });

  it("returns the default for invalid values", () => {
    expect(parsePositiveQueryInt("invalid", 10)).toBe(10);
    expect(parsePositiveQueryInt("25px", 10)).toBe(10);
    expect(parsePositiveQueryInt("0", 10)).toBe(10);
    expect(parsePositiveQueryInt("-1", 10)).toBe(10);
  });
});
