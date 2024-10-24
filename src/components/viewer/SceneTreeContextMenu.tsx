import { Divider, ListItemIcon, ListItemText } from "@mui/material";
import { Row } from "@vertexvis/viewer/dist/types/components/scene-tree/lib/row";
import * as React from "react";

import { ViewerActions } from "../../lib/viewer";
import { ContextMenuItem } from "../shared/ContextMenuItem";
import { Icon } from "../shared/Icon";
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
        label="Hide Part"
        disabled={item == null}
        onClick={() => {
          if (item?.node.id?.hex != null) {
            actions.setVisibility(item.node.id.hex, false);
          }
        }}
      >
        <ListItemIcon>
          <Icon size="sm" name="eye-half" />
        </ListItemIcon>
        <ListItemText>Hide Part</ListItemText>
      </ContextMenuItem>
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
      >
        <ListItemIcon>
          <Icon size="sm" name="eye-half" />
        </ListItemIcon>
        <ListItemText>Hide Selected</ListItemText>
      </ContextMenuItem>
      <ContextMenuItem
        iconName="eye-half"
        iconSize="sm"
        label="Hide All Parts"
        onClick={() => {
          actions.setVisibilityAll(false);
        }}
      >
        <ListItemIcon>
          <Icon size="sm" name="eye-half" />
        </ListItemIcon>
        <ListItemText>Hide All Parts</ListItemText>
      </ContextMenuItem>
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
      >
        <ListItemIcon>
          <Icon size="sm" name="eye-open" />
        </ListItemIcon>
        <ListItemText>Show Only Part</ListItemText>
      </ContextMenuItem>
      <ContextMenuItem
        iconName="eye-open"
        iconSize="sm"
        label="Show Only Selected"
        disabled={!hasSelection}
        onClick={() => {
          actions.showOnlySelected();
        }}
      >
        <ListItemIcon>
          <Icon size="sm" name="eye-open" />
        </ListItemIcon>
        <ListItemText>Show Only Selected</ListItemText>
      </ContextMenuItem>
      <ContextMenuItem
        iconName="eye-open"
        iconSize="sm"
        label="Show All Parts"
        onClick={() => {
          actions.setVisibilityAll(true);
        }}
      >
        <ListItemIcon>
          <Icon size="sm" name="eye-open" />
        </ListItemIcon>
        <ListItemText>Show All Parts</ListItemText>
      </ContextMenuItem>
      <Divider />
      <ContextMenuItem
        iconName="fit"
        iconSize="sm"
        label="Fly To"
        disabled={item == null}
        onClick={() => {
          if (item?.node.id?.hex != null) {
            actions.fit(item.node.id.hex);
          }
        }}
      >
        <ListItemIcon>
          <Icon size="sm" name="eye-open" />
        </ListItemIcon>
        <ListItemText>Fly To</ListItemText>
      </ContextMenuItem>
      <ContextMenuItem
        iconName="fit"
        iconSize="sm"
        label="Fit Selected"
        disabled={!hasSelection}
        onClick={() => {
          actions.fitSelected();
        }}
      >
        <ListItemIcon>
          <Icon size="sm" name="eye-open" />
        </ListItemIcon>
        <ListItemText>Fit Selected</ListItemText>
      </ContextMenuItem>
    </ContextMenu>
  );
};
