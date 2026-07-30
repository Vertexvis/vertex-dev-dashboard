import { SceneData, SceneDataAttributes } from "@vertexvis/api-client-node";

import { GetRes } from "./api";
import { Paged, toPage } from "./paging";

export type Scene = Pick<SceneData, "id"> & SceneDataAttributes;

export function toScene(data: SceneData): Scene {
  return { ...data.attributes, id: data.id };
}

export function toScenePage(res: GetRes<SceneData>): Paged<Scene> {
  return toPage<SceneData, SceneDataAttributes>(res);
}
