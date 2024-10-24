import {
  ModelView,
  ModelViewListResponse,
  PmiAnnotation,
  PmiAnnotationListResponse,
} from "@vertexvis/viewer";
import React from "react";

import { ViewerState } from "./viewer";

export interface UseModelViewsProps {
  readonly itemId?: string;

  readonly viewerState: ViewerState;
}

export interface ModelViewsState {
  readonly modelViewList: ModelView[];
  readonly annotationList: PmiAnnotation[];
  readonly loadedModelViewId?: string;
  readonly loadedSceneItemId?: string;

  readonly actions: UseModelViewActions;
}

export function useModelViews({
  itemId,
  viewerState,
}: UseModelViewsProps): ModelViewsState {
  const [modelViewResponses, setModelViewResponses] = React.useState<
    ModelViewListResponse[]
  >([]);
  const [modelViewCursor, setModelViewCursor] = React.useState<string>();
  const [annotationResponses, setAnnotationResponses] = React.useState<
    PmiAnnotationListResponse[]
  >([]);
  const [annotationCursor, setAnnotationCursor] = React.useState<string>();
  const [loadedModelViewId, setLoadedModelViewId] = React.useState<string>();
  const [loadedSceneItemId, setLoadedSceneItemId] = React.useState<string>();

  function updateLoadedModelViews(response: ModelViewListResponse): void {
    setModelViewResponses([...modelViewResponses, response]);
    setModelViewCursor(response.paging.next);
  }

  function updateLoadedAnnotations(response: PmiAnnotationListResponse): void {
    setAnnotationResponses([...annotationResponses, response]);
    setAnnotationCursor(response.paging.next);
  }

  const actions = useModelViewActions({
    viewerState,
    modelViewResponses,
    modelViewCursor,
    annotationResponses,
    annotationCursor,
    setLoadedModelViewId,
    setLoadedSceneItemId,
    updateLoadedModelViews,
    updateLoadedAnnotations,
  });

  React.useEffect(() => {
    if (itemId != null) {
      setModelViewResponses([]);
      setModelViewCursor(undefined);
    }
  }, [itemId]);

  React.useEffect(() => {
    if (
      itemId != null &&
      modelViewResponses.length === 0 &&
      modelViewCursor == null
    ) {
      setLoadedSceneItemId(itemId);
      actions.fetchNextModelViews(itemId);
    }
  }, [itemId, modelViewResponses, modelViewCursor]);

  React.useEffect(() => {
    setAnnotationResponses([]);
    setAnnotationCursor(undefined);
  }, [loadedModelViewId]);

  React.useEffect(() => {
    if (
      loadedModelViewId != null &&
      annotationResponses.length === 0 &&
      annotationCursor == null
    ) {
      actions.fetchNextAnnotations(loadedModelViewId);
    }
  }, [loadedModelViewId, annotationResponses, annotationCursor]);

  return {
    modelViewList: modelViewResponses.reduce(
      (modelViews, r) => [...modelViews, ...r.modelViews],
      [] as ModelView[]
    ),
    annotationList: annotationResponses.reduce(
      (annotations, r) => [...annotations, ...r.annotations],
      [] as PmiAnnotation[]
    ),
    loadedModelViewId,
    loadedSceneItemId,
    actions,
  };
}

interface UseModelViewActionsProps {
  readonly viewerState: ViewerState;
  readonly modelViewResponses: ModelViewListResponse[];
  readonly modelViewCursor?: string;
  readonly annotationResponses: PmiAnnotationListResponse[];
  readonly annotationCursor?: string;

  readonly setLoadedModelViewId: (id?: string) => void;
  readonly setLoadedSceneItemId: (id?: string) => void;
  readonly updateLoadedModelViews: (response: ModelViewListResponse) => void;
  readonly updateLoadedAnnotations: (
    response: PmiAnnotationListResponse
  ) => void;
}

interface UseModelViewActions {
  fetchNextModelViews: (sceneItemId: string) => Promise<void>;
  loadModelView: (sceneItemId: string, modelViewId: string) => Promise<void>;
  unloadModelView: () => Promise<void>;

  fetchNextAnnotations: (modelViewId: string) => Promise<void>;
}

function useModelViewActions({
  viewerState,
  modelViewResponses,
  modelViewCursor,
  annotationResponses,
  annotationCursor,
  setLoadedModelViewId,
  setLoadedSceneItemId,
  updateLoadedModelViews,
  updateLoadedAnnotations,
}: UseModelViewActionsProps): UseModelViewActions {
  return {
    fetchNextModelViews: async (sceneItemId) => {
      const hasMore =
        modelViewCursor != null || modelViewResponses.length === 0;

      if (hasMore && viewerState.ref.current?.modelViews != null) {
        const resp = await viewerState.ref.current.modelViews.listByItem(
          sceneItemId,
          {
            hasAnnotations: true,
            size: 100,
            cursor: modelViewCursor,
          }
        );

        updateLoadedModelViews(resp);
      }
    },
    loadModelView: async (sceneItemId, modelViewId) => {
      await viewerState.ref.current?.modelViews?.load(sceneItemId, modelViewId);

      setLoadedSceneItemId(sceneItemId);
      setLoadedModelViewId(modelViewId);
    },
    unloadModelView: async () => {
      await viewerState.ref.current?.modelViews?.unload();

      setLoadedModelViewId(undefined);
    },
    fetchNextAnnotations: async (modelViewId) => {
      const hasMore =
        annotationCursor != null || annotationResponses.length === 0;

      if (hasMore && viewerState.ref.current?.pmi != null) {
        const resp = await viewerState.ref.current.pmi.listAnnotations({
          modelViewId,
          size: 100,
          cursor: annotationCursor,
        });

        updateLoadedAnnotations(resp);
      }
    },
  };
}
