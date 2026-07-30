import { PropertyKeyPolicyMode } from "../../lib/property-key-policies";

/**
 * Human-readable label for a policy mode. `allowlist` renders as "Allow" and
 * `denylist` renders as "Deny" per the product-facing terminology.
 *
 * The API contract supplies an enum, but a neutral "Unknown" label prevents a
 * malformed runtime value from being mistaken for either access decision.
 */
export function toModeLabel(mode: PropertyKeyPolicyMode): string {
  switch (mode) {
    case PropertyKeyPolicyMode.Allowlist:
      return "Allow";
    case PropertyKeyPolicyMode.Denylist:
      return "Deny";
    default:
      return "Unknown";
  }
}
