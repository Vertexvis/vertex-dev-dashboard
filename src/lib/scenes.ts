import { SceneData, SceneDataAttributes } from "@vertexvis/api-client-node";

import { GetRes } from "./api";
import { Paged, toPage } from "./paging";

export type Scene = Pick<SceneData, "id"> & SceneDataAttributes;

export function toScenePage(res: GetRes<SceneData>): Paged<Scene> {
  return toPage<SceneData, SceneDataAttributes>(res);
}
