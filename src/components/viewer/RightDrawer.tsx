import { Box, Drawer } from "@mui/material";
import { drawerClasses } from "@mui/material/Drawer";
import { SceneViewStateData } from "@vertexvis/api-client-node";
import React from "react";

import { Metadata } from "../../lib/metadata";
import { ModelViewsState } from "../../lib/model-views";
import { RightDrawerWidth } from "./Layout";
import { MetadataProperties } from "./MetadataProperties";
import { ModelViews } from "./ModelViews";
import { SceneViewStateList } from "./SceneViewStateList";

interface Props {
  readonly active?: string;
  readonly metadata?: Metadata;
  readonly modelViews: ModelViewsState;
  readonly sceneViewStates?: SceneViewStateData[];
  readonly onViewStateSelected: (arg0: string) => void;
}

const MinWidth = 280;
const StorageKey = "viewer.rightDrawerWidth";

function maxWidth(): number {
  if (typeof window === "undefined") return 800;
  return Math.min(800, Math.round(window.innerWidth * 0.7));
}

function clampWidth(width: number): number {
  return Math.max(MinWidth, Math.min(width, maxWidth()));
}

function readStoredWidth(): number {
  if (typeof window === "undefined") return RightDrawerWidth;
  const raw = window.localStorage.getItem(StorageKey);
  const parsed = raw != null ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) ? clampWidth(parsed) : RightDrawerWidth;
}

export function RightDrawer({
  active,
  metadata,
  modelViews,
  sceneViewStates,
  onViewStateSelected,
}: Props): JSX.Element {
  const [width, setWidth] = React.useState(RightDrawerWidth);
  const draggingRef = React.useRef(false);

  React.useEffect(() => {
    setWidth(readStoredWidth());
  }, []);

  React.useEffect(() => {
    function stopDragging() {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.userSelect = "";
      setWidth((current) => {
        window.localStorage.setItem(StorageKey, String(current));
        return current;
      });
    }

    function onMouseMove(event: MouseEvent) {
      if (!draggingRef.current) return;
      setWidth(clampWidth(window.innerWidth - event.clientX));
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", stopDragging);
    window.addEventListener("blur", stopDragging);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", stopDragging);
      window.removeEventListener("blur", stopDragging);
      document.body.style.userSelect = "";
    };
  }, []);

  function handleMouseDown(event: React.MouseEvent) {
    event.preventDefault();
    draggingRef.current = true;
    document.body.style.userSelect = "none";
  }

  function handleDoubleClick() {
    setWidth(RightDrawerWidth);
    window.localStorage.setItem(StorageKey, String(RightDrawerWidth));
  }

  const getDisplayedContent = () => {
    switch (active) {
      case "properties":
        return <MetadataProperties metadata={metadata} />;
      case "scene-view-states":
        return (
          <SceneViewStateList
            sceneViewStates={sceneViewStates}
            onViewStateSelected={onViewStateSelected}
          />
        );
      case "model-views":
        return <ModelViews modelViews={modelViews} metadata={metadata} />;
      default:
        return <></>;
    }
  };

  return (
    <Drawer
      anchor="right"
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
        aria-label="Resize right drawer"
        aria-orientation="vertical"
        onDoubleClick={handleDoubleClick}
        onMouseDown={handleMouseDown}
        role="separator"
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          bottom: 0,
          width: "6px",
          cursor: "col-resize",
          zIndex: 1,
          "&:hover": { backgroundColor: "action.hover" },
        }}
      />
      {getDisplayedContent()}
    </Drawer>
  );
}
