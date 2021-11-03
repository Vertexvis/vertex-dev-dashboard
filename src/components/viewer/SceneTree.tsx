import { Box } from "@mui/material";
import { Environment } from "@vertexvis/viewer";
import { VertexSceneTree } from "@vertexvis/viewer-react";
import React from "react";

interface Props {
  readonly configEnv: Environment;
  readonly viewerId: string;
  readonly selectedItemdId?: string;
  readonly expandAll?: boolean;
  readonly collapseAll?: boolean;
  readonly onRowClick?: (itemId: string) => void;
}

export function SceneTree({
  configEnv,
  viewerId,
  selectedItemdId,
  expandAll,
  collapseAll,
  onRowClick,
}: Props): JSX.Element {
  const ref = React.useRef<HTMLVertexSceneTreeElement>(null);

  React.useEffect(() => {
    const onSelect = (event: Event) => {     
      const row = event.target as HTMLVertexSceneTreeRowElement;
      if (row.node && !row.node?.selected && onRowClick) {
        console.debug(
          `Selected ${row.node.suppliedId?.value ?? row.node.id?.hex},${
            row.node.name
          }`
        );
        onRowClick(row.node.id?.hex || ""); 
      }      
    }

    const effectRef = ref.current;
    effectRef?.addEventListener("selectionToggled", onSelect);
    return () => effectRef?.removeEventListener("selectionToggled", onSelect);
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
    <Box sx={{ overflow: "hidden" }}>
      <VertexSceneTree
        configEnv={configEnv}
        ref={ref}
        viewerSelector={`#${viewerId}`}
      />
    </Box>
  );
}
