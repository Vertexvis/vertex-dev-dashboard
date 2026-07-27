import { PropertyKeyPolicyMode } from "../../lib/property-key-policies";

/**
 * Human-readable label for a policy mode. `allowlist` renders as "Allow" and
 * `denylist` renders as "Deny" per the product-facing terminology.
 *
 * Any other/unexpected value falls back to the raw string (or "Unknown" when
 * empty) rather than silently labeling it "Deny".
 */
export function toModeLabel(mode: PropertyKeyPolicyMode): string {
  switch (mode) {
    case PropertyKeyPolicyMode.Allowlist:
      return "Allow";
    case PropertyKeyPolicyMode.Denylist:
      return "Deny";
    default:
      return (mode as string) || "Unknown";
  }
}
