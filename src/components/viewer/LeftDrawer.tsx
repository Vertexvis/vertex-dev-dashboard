import { ChevronLeft } from "@mui/icons-material";
import { Box, Divider, Drawer, IconButton, Tooltip } from "@mui/material";
import { drawerClasses } from "@mui/material/Drawer";
import { Environment } from "@vertexvis/viewer";
import React from "react";
import { NetworkConfig } from "../../lib/with-session";

import { LeftDrawerWidth } from "./Layout";
import { SceneTree } from "./SceneTree";

interface Props {
  readonly configEnv: Environment;
  readonly onClose: () => void;
  readonly open: boolean;
  readonly viewerId: string;
  readonly networkConfig?: NetworkConfig;
  readonly selectedItemdId?: string;
  readonly onItemSelected: (itemId: string) => void;
}

const IconWidth = "36px";
const ExpandAll = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 16 16"
    data-testid="expand-all"
  >
    <path d="M14.5,6h-5a.5.5,0,0,0,0,1h5a.5.5,0,0,0,0-1ZM4,2.5H2a.5.5,0,0,0-.46.31.47.47,0,0,0,.11.54l1,1a.48.48,0,0,0,.7,0l1-1a.47.47,0,0,0,.11-.54A.5.5,0,0,0,4,2.5ZM5.5,4h9a.5.5,0,0,0,0-1h-9a.5.5,0,0,0,0,1ZM4,8.5H2a.5.5,0,0,0-.46.31.47.47,0,0,0,.11.54l1,1a.48.48,0,0,0,.7,0l1-1a.47.47,0,0,0,.11-.54A.5.5,0,0,0,4,8.5ZM14.5,9h-9a.5.5,0,0,0,0,1h9a.5.5,0,0,0,0-1Zm0,3h-5a.5.5,0,0,0,0,1h5a.5.5,0,0,0,0-1Z" />
  </svg>
);

const CollapseAll = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 16 16"
    data-testid="collapse-all"
  >
    <path d="M2.85,8.15A.47.47,0,0,0,2.31,8,.5.5,0,0,0,2,8.5v2a.5.5,0,0,0,.31.46.47.47,0,0,0,.54-.11l1-1a.48.48,0,0,0,0-.7Zm0-6A.47.47,0,0,0,2.31,2,.5.5,0,0,0,2,2.5v2A.5.5,0,0,0,2.31,5a.47.47,0,0,0,.54-.11l1-1a.48.48,0,0,0,0-.7ZM5.5,4h9a.5.5,0,0,0,0-1h-9a.5.5,0,0,0,0,1Zm9,2h-9a.5.5,0,0,0,0,1h9a.5.5,0,0,0,0-1Zm0,3h-9a.5.5,0,0,0,0,1h9a.5.5,0,0,0,0-1Zm0,3h-9a.5.5,0,0,0,0,1h9a.5.5,0,0,0,0-1Z" />
  </svg>
);

export function LeftDrawer({
  configEnv,
  open,
  viewerId,
  selectedItemdId,
  networkConfig,
  onClose,
  onItemSelected,
}: Props): JSX.Element {
  const [expandAll, setExpandAll] = React.useState<boolean | undefined>();
  const [collapseAll, setCollapseAll] = React.useState<boolean | undefined>();

  return (
    <Drawer
      anchor="left"
      open={open}
      variant="persistent"
      sx={{
        [`& .${drawerClasses.paper}`]: { position: "relative", width: 0 },
        [`& .${drawerClasses.paperAnchorLeft}`]: { width: LeftDrawerWidth },
      }}
    >
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
              sx={{ width: IconWidth }}
              onClick={() => {
                setExpandAll(true);
                setCollapseAll(false);
              }}
            >
              <ExpandAll />
            </IconButton>
          </Tooltip>
          <Tooltip title="Collapse All">
            <IconButton
              sx={{ width: IconWidth }}
              onClick={() => {
                setCollapseAll(true);
                setExpandAll(false);
              }}
            >
              <CollapseAll />
            </IconButton>
          </Tooltip>
        </Box>
        <IconButton onClick={onClose}>
          <ChevronLeft />
        </IconButton>
      </Box>
      <Divider />
      <SceneTree
        configEnv={configEnv}
        viewerId={viewerId}
        selectedItemdId={selectedItemdId}
        expandAll={expandAll}
        networkConfig={networkConfig}
        collapseAll={collapseAll}
        onRowClick={(itemId) => {
          onItemSelected(itemId);
          setExpandAll(undefined);
          setCollapseAll(undefined);
        }}
      />
    </Drawer>
  );
}
