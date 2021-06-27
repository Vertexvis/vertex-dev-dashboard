import { PartData, PartDataAttributes } from "@vertexvis/api-client-node";

import { GetRes } from "./api";
import { Paged, toPage } from "./paging";

export type Part = Pick<PartData, "id"> & PartDataAttributes;

export function toPartPage(res: GetRes<PartData>): Paged<Part> {
  return toPage<PartData, PartDataAttributes>(res);
}
