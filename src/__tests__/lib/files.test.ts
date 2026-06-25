import { toFileStatusDisplay } from "../../lib/files";

describe("toFileStatusDisplay", () => {
  it.each([
    ["complete", "File Ready"],
    ["error", "Error"],
    ["pending", "Pending"],
  ])("formats %s as %s", (status, label) => {
    expect(toFileStatusDisplay(status)).toBe(label);
  });

  it("falls back to the original status for unknown values", () => {
    expect(toFileStatusDisplay("processing")).toBe("processing");
  });

  it("returns undefined when status is missing", () => {
    expect(toFileStatusDisplay(undefined)).toBeUndefined();
  });
});
