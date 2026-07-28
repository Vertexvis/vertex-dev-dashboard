import { Box } from "@mui/material";
import { VertexSceneTreeTableCellCustomEvent } from "@vertexvis/viewer";
import { SceneTreeTableCellEventDetails } from "@vertexvis/viewer/dist/types/components/scene-tree-table-cell/scene-tree-table-cell";
import { VertexSceneTree } from "@vertexvis/viewer-react";
import React from "react";

import { ViewerContext } from "../../lib/ai/viewer-command";
import { viewerHasSelection, ViewerState } from "../../lib/viewer";
import { EnvironmentWithCustom, NetworkConfig } from "../../lib/with-session";
import { SceneTreeContextMenu } from "./SceneTreeContextMenu";

interface Props {
  readonly configEnv: EnvironmentWithCustom;
  readonly viewerId: string;
  readonly selectedItemId?: string;
  readonly expandAll?: boolean;
  readonly collapseAll?: boolean;
  readonly networkConfig?: NetworkConfig;
  readonly viewerState: ViewerState;

  readonly onRowClick?: (itemId: string) => void;
  readonly onLoadedTreeChanged?: (
    tree: NonNullable<ViewerContext["loadedTree"]>
  ) => void;
}

export function SceneTree({
  configEnv,
  viewerId,
  selectedItemId,
  expandAll,
  collapseAll,
  networkConfig,
  viewerState,
  onRowClick,
  onLoadedTreeChanged,
}: Props): JSX.Element {
  const ref = React.useRef<HTMLVertexSceneTreeElement>(null);

  React.useEffect(() => {
    const effectRef = ref.current;

    const onSelection = (
      event: VertexSceneTreeTableCellCustomEvent<SceneTreeTableCellEventDetails>
    ): void => {
      const node = event.detail.node;
      if (node != null && onRowClick) {
        console.debug(
          `Selected ${node.suppliedId?.value ?? node.id?.hex},${node.name}`
        );

        onRowClick(node.id?.hex || "");
      }
    };

    effectRef?.addEventListener(
      "selectionToggled",
      onSelection as EventListener
    );
    return () =>
      effectRef?.removeEventListener(
        "selectionToggled",
        onSelection as EventListener
      );
  }, [ref, onRowClick]);

  React.useEffect(() => {
    const effectRef = ref.current;
    if (selectedItemId) effectRef?.scrollToItem(selectedItemId);
  }, [selectedItemId]);

  React.useEffect(() => {
    const effectRef = ref.current;
    if (expandAll) effectRef?.expandAll();
  }, [expandAll]);

  React.useEffect(() => {
    const effectRef = ref.current;
    if (collapseAll) effectRef?.collapseAll();
  }, [collapseAll]);

  React.useEffect(() => {
    let subscription: { dispose(): void } | undefined;
    let retryId: number | undefined;

    const subscribe = (): void => {
      const controller = ref.current?.controller;
      if (controller == null) {
        retryId = window.setTimeout(subscribe, 100);
        return;
      }
      subscription = controller.stateChanged((state) => {
        if (state == null) return;
        const rows = state.rows
          .flatMap((row) =>
            row == null
              ? []
              : [
                  {
                    name: row.node.name || undefined,
                    itemId: row.node.id?.hex || undefined,
                    suppliedId: row.node.suppliedId?.value || undefined,
                    metadata: Object.fromEntries(
                      Object.entries(row.metadata)
                        .filter(([, value]) => value != null)
                        .slice(0, 20)
                        .map(([key, value]) => [key, value ?? ""])
                    ),
                  },
                ]
          )
          .slice(0, 100);
        onLoadedTreeChanged?.({
          totalRows: state.totalRows,
          totalFilteredRows: state.totalFilteredRows,
          filterTerm: state.filterTerm,
          rows,
        });
      });
    };

    subscribe();
    return () => {
      if (retryId != null) window.clearTimeout(retryId);
      subscription?.dispose();
    };
  }, [onLoadedTreeChanged]);

  return (
    <Box sx={{ height: "100%" }}>
      <VertexSceneTree
        configEnv={configEnv !== "custom" ? configEnv : undefined}
        id="vertex-scene-tree"
        config={
          networkConfig != null && configEnv === "custom"
            ? JSON.stringify({
                network: {
                  ...networkConfig,
                },
              })
            : undefined
        }
        ref={ref}
        viewerSelector={`#${viewerId}`}
      />

      <SceneTreeContextMenu
        sceneTree={ref}
        hasSelection={viewerHasSelection(viewerState.ref)}
        actions={viewerState.actions}
      />
    </Box>
  );
}
