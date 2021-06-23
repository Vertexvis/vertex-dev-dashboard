import { PartData, PartDataAttributes } from "@vertexvis/api-client-node";

import { GetPartsRes } from "../pages/api/parts";
import { Paged } from "./paging";

export type Part = Pick<PartData, "id"> & PartDataAttributes;

export function toPartData(res: GetPartsRes): Paged<Part> {
  return {
    cursor: res.cursor ?? null,
    items: res.data.map((i) => ({ ...i.attributes, id: i.id })),
  };
}
