import { Divider } from "@mui/material";
import { Row } from "@vertexvis/viewer/dist/types/components/scene-tree/lib/row";
import * as React from "react";

import { ViewerActions } from "../../lib/viewer";
import { ContextMenuItem } from "../shared/ContextMenuItem";
import { ContextMenu } from "./ContextMenu";

export interface Props {
  readonly sceneTree: React.MutableRefObject<HTMLVertexSceneTreeElement | null>;
  readonly hasSelection: boolean;

  readonly actions: ViewerActions;
}

export const SceneTreeContextMenu = ({
  sceneTree,
  hasSelection,
  actions,
}: Props): JSX.Element => {
  const [item, setItem] = React.useState<Row>();

  return (
    <ContextMenu
      predicate={(target) =>
        target instanceof HTMLElement &&
        target.tagName.includes("VERTEX-SCENE-TREE")
      }
      onOpen={async (event) =>
        setItem(await sceneTree.current?.getRowForEvent(event))
      }
    >
      <ContextMenuItem
        iconName="eye-half"
        iconSize="sm"
        label="Hide Selected"
        disabled={!hasSelection}
        onClick={() => {
          if (item?.node.id?.hex != null) {
            actions.setVisibilitySelected(false);
          }
        }}
      />
      <ContextMenuItem
        iconName="eye-half"
        iconSize="sm"
        label="Hide All Parts"
        onClick={() => {
          actions.setVisibilityAll(false);
        }}
      />
      <ContextMenuItem
        iconName="eye-open"
        iconSize="sm"
        label="Show Only Part"
        disabled={item == null}
        onClick={() => {
          if (item?.node.id?.hex != null) {
            actions.showOnly(item.node.id.hex);
          }
        }}
      />
      <ContextMenuItem
        iconName="eye-open"
        iconSize="sm"
        label="Show Only Selected"
        disabled={!hasSelection}
        onClick={() => {
          actions.showOnlySelected();
        }}
      />
      <ContextMenuItem
        iconName="eye-open"
        iconSize="sm"
        label="Show All Parts"
        onClick={() => {
          actions.setVisibilityAll(true);
        }}
      />
      <Divider />
      <ContextMenuItem
        iconName="fit"
        iconSize="sm"
        label="Fly To"
        disabled={item == null || !item.node.visible}
        onClick={() => {
          if (item?.node.id?.hex != null) {
            actions.fit(item.node.id.hex);
          }
        }}
      />
      <ContextMenuItem
        iconName="fit"
        iconSize="sm"
        label="Fit Selected"
        disabled={!hasSelection}
        onClick={() => {
          actions.fitSelected();
        }}
      />
    </ContextMenu>
  );
};
