import { Box, Drawer } from "@mui/material";
import { drawerClasses } from "@mui/material/Drawer";
import React from "react";

import { ViewerState } from "../../lib/viewer";
import { EnvironmentWithCustom, NetworkConfig } from "../../lib/with-session";
import { Title } from "../shared/Title";
import { LeftDrawerWidth } from "./Layout";
import { SceneTreePanel } from "./SceneTreePanel";

interface Props {
  readonly active?: string;
  readonly configEnv: EnvironmentWithCustom;
  readonly viewerId: string;
  readonly networkConfig?: NetworkConfig;
  readonly selectedItemId?: string;
  readonly viewerState: ViewerState;

  readonly onItemSelected: (itemId: string) => void;
}

const MinWidth = 280;
const StorageKey = "viewer.leftDrawerWidth";

function maxWidth(): number {
  if (typeof window === "undefined") return 800;
  return Math.min(800, Math.round(window.innerWidth * 0.7));
}

function clampWidth(width: number): number {
  return Math.max(MinWidth, Math.min(width, maxWidth()));
}

function readStoredWidth(): number {
  if (typeof window === "undefined") return LeftDrawerWidth;
  const raw = window.localStorage.getItem(StorageKey);
  const parsed = raw != null ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) ? clampWidth(parsed) : LeftDrawerWidth;
}

export function LeftDrawer({
  active,
  configEnv,
  viewerId,
  selectedItemId,
  networkConfig,
  viewerState,
  onItemSelected,
}: Props): JSX.Element {
  const [width, setWidth] = React.useState(LeftDrawerWidth);
  const draggingRef = React.useRef(false);

  React.useEffect(() => {
    setWidth(readStoredWidth());
  }, []);

  React.useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!draggingRef.current) return;
      setWidth(clampWidth(e.clientX));
    }

    function onMouseUp() {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.userSelect = "";
      setWidth((current) => {
        window.localStorage.setItem(StorageKey, String(current));
        return current;
      });
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.userSelect = "";
    };
  }, []);

  function handleMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.userSelect = "none";
  }

  function handleDoubleClick() {
    setWidth(LeftDrawerWidth);
    window.localStorage.setItem(StorageKey, String(LeftDrawerWidth));
  }

  const getDisplayedHeader = () => {
    switch (active) {
      case "scene-tree":
        return "Assembly";
      default:
        return "";
    }
  };

  const getActiveContent = () => {
    switch (active) {
      case "scene-tree":
        return (
          <SceneTreePanel
            configEnv={configEnv}
            viewerId={viewerId}
            networkConfig={networkConfig}
            selectedItemId={selectedItemId}
            viewerState={viewerState}
            onItemSelected={onItemSelected}
          />
        );
      default:
        return <></>;
    }
  };

  return (
    <Drawer
      anchor="left"
      sx={{
        display: { sm: "block", xs: "none" },
        position: "relative",
        width,
        [`& .${drawerClasses.paper}`]: { width },
      }}
      PaperProps={{
        style: { width },
        sx: {
          position: "relative",
        },
      }}
      variant="permanent"
    >
      <Box
        aria-label="Resize left drawer"
        aria-orientation="vertical"
        onDoubleClick={handleDoubleClick}
        onMouseDown={handleMouseDown}
        role="separator"
        sx={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: "6px",
          cursor: "col-resize",
          zIndex: 1,
          "&:hover": { backgroundColor: "action.hover" },
        }}
      />
      <Title
        sx={{
          borderBottom: "1px solid #ccc",
        }}
      >
        {getDisplayedHeader()}
      </Title>
      {getActiveContent()}
    </Drawer>
  );
}
