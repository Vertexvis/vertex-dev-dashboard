import { toModeLabel } from "../../../components/property-key-policy/mode";
import { PropertyKeyPolicyMode } from "../../../lib/property-key-policies";

describe("toModeLabel", () => {
  it("maps allowlist to Allow", () => {
    expect(toModeLabel(PropertyKeyPolicyMode.Allowlist)).toBe("Allow");
  });

  it("maps denylist to Deny", () => {
    expect(toModeLabel(PropertyKeyPolicyMode.Denylist)).toBe("Deny");
  });

  it("falls back to Unknown for unexpected modes", () => {
    expect(toModeLabel("something-else" as PropertyKeyPolicyMode)).toBe(
      "Unknown",
    );
  });
});
