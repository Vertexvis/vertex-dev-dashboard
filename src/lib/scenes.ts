import { SceneData, SceneDataAttributes } from "@vertexvis/api-client-node";

import { GetSceneRes } from "../pages/api/scenes";

export type Scene = Pick<SceneData, "id"> & SceneDataAttributes;

export interface Paged<T> {
  cursor: string | null; // Must use null for proper NextJS serialization
  items: T[];
}

export function toSceneData(res: GetSceneRes): Paged<Scene> {
  return {
    cursor: res.cursor ?? null,
    items: res.data.map((i) => ({ ...i.attributes, id: i.id })),
  };
}
