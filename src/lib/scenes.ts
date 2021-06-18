import { GetSceneRes } from "../pages/api/scenes";

export interface Scene {
  readonly created?: string;
  readonly id: string;
  readonly name?: string;
  readonly suppliedId?: string;
}

export interface Paged<T> {
  cursor: string | null; // Must use null for proper NextJS serialization
  items: T[];
}

export function toSceneData(res: GetSceneRes): Paged<Scene> {
  return {
    cursor: res.cursor ?? null,
    items: res.data.map((i) => ({
      created: i.attributes.created,
      id: i.id,
      name: i.attributes.name,
      suppliedId: i.attributes.suppliedId,
    })),
  };
}
