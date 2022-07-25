import { Box } from "@mui/material";
import { VertexSceneTreeTableCellCustomEvent } from "@vertexvis/viewer";

import { SceneTreeTableCellEventDetails } from "@vertexvis/viewer/dist/types/components/scene-tree-table-cell/scene-tree-table-cell";
import { VertexSceneTree } from "@vertexvis/viewer-react";
import React from "react";
import { EnvironmentWithCustom, NetworkConfig } from "../../lib/with-session";

interface Props {
  readonly configEnv: EnvironmentWithCustom;
  readonly viewerId: string;
  readonly selectedItemdId?: string;
  readonly expandAll?: boolean;
  readonly collapseAll?: boolean;
  readonly networkConfig?: NetworkConfig;
  readonly onRowClick?: (itemId: string) => void;
}

export function SceneTree({
  configEnv,
  viewerId,
  selectedItemdId,
  expandAll,
  collapseAll,
  networkConfig,
  onRowClick,
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
    if (selectedItemdId) effectRef?.scrollToItem(selectedItemdId);
  }, [selectedItemdId]);

  React.useEffect(() => {
    const effectRef = ref.current;
    if (expandAll) effectRef?.expandAll();
  }, [expandAll]);

  React.useEffect(() => {
    const effectRef = ref.current;
    if (collapseAll) effectRef?.collapseAll();
  }, [collapseAll]);

  console.log("configEnv: ", configEnv, "networkConfig", networkConfig);
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
    </Box>
  );
}
