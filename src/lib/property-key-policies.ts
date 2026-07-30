import {
  PropertyKeyPolicyData,
  PropertyKeyPolicyDataAttributes,
  PropertyKeyPolicyMode,
} from "@vertexvis/api-client-node";

import { GetRes } from "./api";
import { Paged, toPage } from "./paging";

export { PropertyKeyPolicyMode };

export type PropertyKeyPolicy = Pick<PropertyKeyPolicyData, "id"> & {
  readonly name?: string;
  readonly mode: PropertyKeyPolicyMode;
  readonly suppliedId?: string;
};

export function toPolicyPage(
  res: GetRes<PropertyKeyPolicyData>
): Paged<PropertyKeyPolicy> {
  return toPage<PropertyKeyPolicyData, PropertyKeyPolicyDataAttributes>(res);
}
