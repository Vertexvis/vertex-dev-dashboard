import { toLocalDayBoundaryIso } from "../../lib/dates";

describe("toLocalDayBoundaryIso", () => {
  it.each([
    ["start", 0, 0, 0, 0],
    ["end", 23, 59, 59, 999],
  ] as const)(
    "returns the %s of the selected local day",
    (boundary, hours, minutes, seconds, milliseconds) => {
      const result = new Date(toLocalDayBoundaryIso("2026-06-11", boundary));

      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(5);
      expect(result.getDate()).toBe(11);
      expect(result.getHours()).toBe(hours);
      expect(result.getMinutes()).toBe(minutes);
      expect(result.getSeconds()).toBe(seconds);
      expect(result.getMilliseconds()).toBe(milliseconds);
    }
  );
});
