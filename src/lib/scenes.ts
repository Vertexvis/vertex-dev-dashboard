import { SceneData, SceneDataAttributes } from "@vertexvis/api-client-node";

import { GetSceneRes } from "../pages/api/scenes";
import { Paged } from "./paging";

export type Scene = Pick<SceneData, "id"> & SceneDataAttributes;

export function toSceneData(res: GetSceneRes): Paged<Scene> {
  return {
    cursor: res.cursor ?? null,
    items: res.data.map((i) => ({ ...i.attributes, id: i.id })),
  };
}
