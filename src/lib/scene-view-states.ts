import {
  SceneViewStateData,
  SceneViewStateDataAttributes,
} from "@vertexvis/api-client-node";

export type SceneViewState = Pick<SceneViewStateData, "id"> &
  SceneViewStateDataAttributes;
