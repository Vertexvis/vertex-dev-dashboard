import { Divider } from "@mui/material";
import { vertexvis } from "@vertexvis/frame-streaming-protos";
import * as React from "react";

import { ViewerActions } from "../../lib/viewer";
import { ContextMenuItem } from "../shared/ContextMenuItem";
import { ContextMenu } from "./ContextMenu";

export interface Props {
  readonly hit?: vertexvis.protobuf.stream.IHit;
  readonly hasSelection: boolean;

  readonly actions: ViewerActions;
}

export const ViewerContextMenu = ({
  hit,
  hasSelection,
  actions,
}: Props): JSX.Element => {
  return (
    <ContextMenu
      predicate={(target) =>
        target instanceof HTMLElement && target.tagName === "VERTEX-VIEWER"
      }
    >
      <ContextMenuItem
        iconName="eye-half"
        iconSize="sm"
        label="Hide Part"
        disabled={hit == null}
        onClick={() => {
          if (hit?.itemId?.hex != null) {
            actions.setVisibility(hit.itemId.hex, false);
          }
        }}
      />
      <ContextMenuItem
        iconName="eye-half"
        iconSize="sm"
        label="Hide Selected"
        disabled={!hasSelection}
        onClick={() => {
          actions.setVisibilitySelected(false);
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
        disabled={hit == null}
        onClick={() => {
          if (hit?.itemId?.hex != null) {
            actions.showOnly(hit.itemId.hex);
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
        disabled={hit == null}
        onClick={() => {
          if (hit?.itemId?.hex != null) {
            actions.fit(hit.itemId.hex);
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
