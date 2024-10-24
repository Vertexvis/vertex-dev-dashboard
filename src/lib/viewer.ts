import {
  RootQuery,
  Scene,
  SceneItemOperationsBuilder,
} from "@vertexvis/viewer";
import { SceneItemQueryExecutor } from "@vertexvis/viewer/dist/types/lib/scenes/queries";
import { defineCustomElements } from "@vertexvis/viewer/loader";
import React from "react";

export interface ViewerState {
  readonly ref: React.MutableRefObject<HTMLVertexViewerElement | null>;
  readonly isReady: boolean;

  readonly actions: ViewerActions;
}

export function useViewer(): ViewerState {
  const viewerRef = React.useRef<HTMLVertexViewerElement>(null);
  const [isReady, setIsReady] = React.useState(false);

  const actions = useViewerActions({
    element: viewerRef.current,
  });

  React.useEffect(() => {
    defineCustomElements().then(() => setIsReady(true));
  }, []);

  return { ref: viewerRef, isReady, actions };
}

interface UseViewerActionsProps {
  element?: HTMLVertexViewerElement | null;
}

export interface ViewerActions {
  showOnly: (itemId: string) => Promise<void>;
  showOnlySelected: () => Promise<void>;
  setVisibility: (itemId: string, visible: boolean) => Promise<void>;
  setVisibilityAll: (visible: boolean) => Promise<void>;
  setVisibilitySelected: (visible: boolean) => Promise<void>;

  fit: (itemId: string) => Promise<void>;
  fitSelected: () => Promise<void>;

  reset: () => Promise<void>;
}

function useViewerActions({ element }: UseViewerActionsProps): ViewerActions {
  async function setVisibility(
    scene: Scene,
    visible: boolean,
    queryBuilder: (op: SceneItemQueryExecutor) => SceneItemOperationsBuilder
  ): Promise<void> {
    await scene
      .items((op) => {
        const builder = queryBuilder(op);

        if (visible) {
          return builder.show();
        } else {
          return builder.hide();
        }
      })
      .execute();
  }

  return {
    showOnly: async (itemId) => {
      const scene = await element?.scene();

      if (scene != null) {
        await scene
          .items((op) => [
            op.where((q) => q.all()).hide(),
            op.where((q) => q.withItemIds([itemId])).show(),
          ])
          .execute();
      }
    },
    showOnlySelected: async () => {
      const scene = await element?.scene();

      if (scene != null) {
        await scene
          .items((op) => [
            op.where((q) => q.all()).hide(),
            op.where((q) => q.withSelected()).show(),
          ])
          .execute();
      }
    },
    setVisibility: async (itemId, visible) => {
      const scene = await element?.scene();

      if (scene != null) {
        await setVisibility(scene, visible, (op) =>
          op.where((q) => q.withItemIds([itemId]))
        );
      }
    },
    setVisibilityAll: async (visible) => {
      const scene = await element?.scene();

      if (scene != null) {
        await setVisibility(scene, visible, (op) => op.where((q) => q.all()));
      }
    },
    setVisibilitySelected: async (visible) => {
      const scene = await element?.scene();

      if (scene != null) {
        await setVisibility(scene, visible, (op) =>
          op.where((q) => q.withSelected())
        );
      }
    },
    fit: async (itemId) => {
      const scene = await element?.scene();

      if (scene != null) {
        await scene
          .camera()
          .flyTo({
            itemId,
          })
          .render({ animation: { milliseconds: 500 } });
      }
    },
    fitSelected: async () => {
      const scene = await element?.scene();
      const bounds =
        element?.frame?.scene.sceneViewSummary.selectedVisibleSummary
          ?.boundingBox;

      if (scene != null && bounds != null) {
        await scene
          .camera()
          .flyTo((q) => q.withBoundingBox(bounds))
          .render({ animation: { milliseconds: 500 } });
      }
    },
    reset: async () => {
      const scene = await element?.scene();

      if (scene != null) {
        await scene.reset({ includeCamera: true });
      }
    },
  };
}

export function viewerHasSelection(
  viewer: React.MutableRefObject<HTMLVertexViewerElement | null>
): boolean {
  return (
    viewer.current?.frame?.scene.sceneViewSummary.selectedVisibleSummary !=
      null &&
    viewer.current.frame.scene.sceneViewSummary.selectedVisibleSummary.count > 0
  );
}
