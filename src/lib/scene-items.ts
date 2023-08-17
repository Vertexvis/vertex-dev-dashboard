import { Vector3 } from "@vertexvis/api-client-node";
import { vertexvis } from "@vertexvis/frame-streaming-protos";
import { Components } from "@vertexvis/viewer";

import { AnimationDurationMs } from "../components/viewer/Viewer";

interface Req {
  readonly viewer: Components.VertexViewer | null;
}

interface SelectByHitReq extends Req {
  readonly hit?: vertexvis.protobuf.stream.IHit;
}

interface ApplySceneViewStateReq extends Req {
  readonly id: string;
}

export async function copySceneViewCamera({ viewer }: Req): Promise<void> {
  if (viewer == null) return;

  const scene = await viewer.scene();
  if (scene == null) return;

  const { lookAt, position, up } = scene.camera();
  await navigator.clipboard.writeText(JSON.stringify({ position, up, lookAt }));
}

export async function getCamera({
  viewer,
}: Req): Promise<
  { lookAt: Vector3; position: Vector3; up: Vector3 } | undefined
> {
  if (viewer == null) return;

  const scene = await viewer.scene();
  if (scene == null) return;

  return scene.camera();
}

export async function fitAll({ viewer }: Req): Promise<void> {
  if (viewer == null) return;

  const scene = await viewer.scene();
  if (scene == null) return;

  await scene
    ?.camera()
    .viewAll()
    .render({ animation: { milliseconds: AnimationDurationMs } });
}

export async function selectByHit({
  hit,
  viewer,
}: SelectByHitReq): Promise<void> {
  if (viewer == null) return;

  const scene = await viewer.scene();
  if (scene == null) return;

  const id = hit?.itemId?.hex;
  if (id) {
    await scene
      .items((op) => [
        op.where((q) => q.all()).deselect(),
        op.where((q) => q.withItemId(id)).select(),
      ])
      .execute();
  } else {
    await scene.items((op) => op.where((q) => q.all()).deselect()).execute();
  }
}

export async function applySceneViewState({
  id,
  viewer,
}: ApplySceneViewStateReq): Promise<void> {
  if (viewer == null) return;
  const scene = await viewer.scene();
  if (scene == null) return;

  await scene.applySceneViewState(id);
}
