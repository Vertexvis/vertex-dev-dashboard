import { Box } from "@mui/material";
import { Environment } from "@vertexvis/viewer";
import { VertexSceneTree } from "@vertexvis/viewer-react";
import React from "react";
import { NetworkConfig } from "../../lib/with-session";

interface Props {
  readonly configEnv: Environment;
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
    const onSelect = async (event: MouseEvent) => {
      const row = await ref?.current?.getRowAtClientY(event.clientY);
      if (row?.node && !row.node?.selected && onRowClick) {
        console.debug(
          `Selected ${row.node.suppliedId?.value ?? row.node.id?.hex},${
            row.node.name
          }`
        );

        onRowClick(row.node.id?.hex || "");
      }
    };

    const effectRef = ref.current;
    effectRef?.addEventListener("click", onSelect);
    return () => effectRef?.removeEventListener("click", onSelect);
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

  return (
    <Box sx={{ height: "100%" }}>
      <VertexSceneTree
        configEnv={networkConfig == null ? configEnv : undefined}
        id="vertex-scene-tree"
        config={
          networkConfig != null
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
