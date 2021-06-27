import {
  PartRevisionData,
  PartRevisionDataAttributes,
} from "@vertexvis/api-client-node";

import { GetRes } from "./api";
import { Paged, toPage } from "./paging";

export type PartRevision = Pick<PartRevisionData, "id"> &
  PartRevisionDataAttributes;

export function toPartRevisionPage(
  res: GetRes<PartRevisionData>
): Paged<PartRevision> {
  return toPage<PartRevisionData, PartRevisionDataAttributes>(res);
}
