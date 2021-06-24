import {
  PartRevisionData,
  PartRevisionDataAttributes,
} from "@vertexvis/api-client-node";

import { GetPartRevisionsRes } from "../pages/api/part-revisions";
import { Paged } from "./paging";

export type PartRevision = Pick<PartRevisionData, "id"> &
  PartRevisionDataAttributes;

export function toPartRevisionData(
  res: GetPartRevisionsRes
): Paged<PartRevision> {
  return {
    cursor: res.cursor ?? null,
    items: res.data.map((i) => ({ ...i.attributes, id: i.id })),
  };
}
