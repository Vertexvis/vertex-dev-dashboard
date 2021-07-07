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
    const clickRow = async (
      event: MouseEvent | PointerEvent
    ): Promise<void> => {
      const row = await ref?.current?.getRowForEvent(event);
      if (row?.node == null) return;

      if (onRowClick) onRowClick(row.node.id?.hex || "");

      console.debug(
        `Selected ${row.node.suppliedId?.value ?? row.node.id?.hex},${
          row.node.name
        }`
      );
    };

    const effectRef = ref.current;
    effectRef?.addEventListener("click", clickRow);
    return () => effectRef?.removeEventListener("click", clickRow);
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
    <VertexSceneTree
      configEnv={configEnv}
      ref={ref}
      viewerSelector={`#${viewerId}`}
    />
  );
}
