import { Box, Divider, IconButton, Tooltip } from "@mui/material";
import React from "react";

import { ViewerState } from "../../lib/viewer";
import { EnvironmentWithCustom, NetworkConfig } from "../../lib/with-session";
import { Icon } from "../shared/Icon";
import { SceneTree } from "./SceneTree";

interface Props {
  readonly configEnv: EnvironmentWithCustom;
  readonly viewerId: string;
  readonly networkConfig?: NetworkConfig;
  readonly selectedItemId?: string;
  readonly viewerState: ViewerState;

  readonly onItemSelected: (itemId: string) => void;
}

export const SceneTreePanel = ({
  configEnv,
  viewerId,
  networkConfig,
  selectedItemId,
  viewerState,
  onItemSelected,
}: Props): JSX.Element => {
  const sceneTreeRef = React.useRef<HTMLVertexSceneTreeElement>();

  const [expandAll, setExpandAll] = React.useState<boolean | undefined>();
  const [collapseAll, setCollapseAll] = React.useState<boolean | undefined>();

  return (
    <>
      <Box
        sx={{
          alignItems: "center",
          display: "flex",
          justifyContent: "space-between",
          py: 0.5,
        }}
      >
        <Box>
          <Tooltip title="Expand All">
            <IconButton
              size="small"
              onClick={() => {
                setExpandAll(true);
                setCollapseAll(false);
              }}
            >
              <Icon size="sm" name="expand-all" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Collapse All">
            <IconButton
              size="small"
              onClick={() => {
                setCollapseAll(true);
                setExpandAll(false);
              }}
            >
              <Icon size="sm" name="expand-all" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      <Divider />
      <SceneTree
        configEnv={configEnv}
        viewerId={viewerId}
        selectedItemId={selectedItemId}
        expandAll={expandAll}
        networkConfig={networkConfig}
        collapseAll={collapseAll}
        viewerState={viewerState}
        onRowClick={(itemId) => {
          onItemSelected(itemId);
          setExpandAll(undefined);
          setCollapseAll(undefined);
        }}
      />
    </>
  );
};
