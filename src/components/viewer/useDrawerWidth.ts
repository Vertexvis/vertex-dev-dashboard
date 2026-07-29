import React from "react";

const MinWidth = 280;
const MaxWidth = 800;
const KeyboardStep = 20;

type Anchor = "left" | "right";

interface Options {
  readonly anchor: Anchor;
  readonly defaultWidth: number;
  readonly storageKey: string;
}

interface DrawerWidthControls {
  readonly maxWidth: number;
  readonly width: number;
  readonly handleDoubleClick: () => void;
  readonly handleKeyDown: (event: React.KeyboardEvent) => void;
  readonly handleMouseDown: (event: React.MouseEvent) => void;
}

function getMaxWidth(): number {
  if (typeof window === "undefined") return MaxWidth;
  return Math.min(MaxWidth, Math.round(window.innerWidth * 0.7));
}

function clampWidth(width: number): number {
  return Math.max(MinWidth, Math.min(width, getMaxWidth()));
}

function readStoredWidth(defaultWidth: number, storageKey: string): number {
  if (typeof window === "undefined") return defaultWidth;
  const raw = window.localStorage.getItem(storageKey);
  const parsed = raw != null ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) ? clampWidth(parsed) : defaultWidth;
}

export function useDrawerWidth({
  anchor,
  defaultWidth,
  storageKey,
}: Options): DrawerWidthControls {
  const [width, setWidth] = React.useState(defaultWidth);
  const draggingRef = React.useRef(false);

  React.useEffect(() => {
    setWidth(readStoredWidth(defaultWidth, storageKey));
  }, [defaultWidth, storageKey]);

  const persistWidth = React.useCallback(
    (nextWidth: number) => {
      window.localStorage.setItem(storageKey, String(nextWidth));
    },
    [storageKey]
  );

  const stopDragging = React.useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    document.body.style.userSelect = "";
    setWidth((current) => {
      persistWidth(current);
      return current;
    });
  }, [persistWidth]);

  React.useEffect(() => {
    function onMouseMove(event: MouseEvent) {
      if (!draggingRef.current) return;
      const pointerWidth =
        anchor === "left" ? event.clientX : window.innerWidth - event.clientX;
      setWidth(clampWidth(pointerWidth));
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
  }, [anchor, stopDragging]);

  const setAndPersistWidth = React.useCallback(
    (nextWidth: number) => {
      const clampedWidth = clampWidth(nextWidth);
      setWidth(clampedWidth);
      persistWidth(clampedWidth);
    },
    [persistWidth]
  );

  function handleMouseDown(event: React.MouseEvent) {
    event.preventDefault();
    draggingRef.current = true;
    document.body.style.userSelect = "none";
  }

  function handleDoubleClick() {
    setAndPersistWidth(defaultWidth);
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    switch (event.key) {
      case "ArrowLeft":
        event.preventDefault();
        setAndPersistWidth(width - KeyboardStep);
        break;
      case "ArrowRight":
        event.preventDefault();
        setAndPersistWidth(width + KeyboardStep);
        break;
      case "Home":
        event.preventDefault();
        setAndPersistWidth(MinWidth);
        break;
      case "End":
        event.preventDefault();
        setAndPersistWidth(getMaxWidth());
        break;
      default:
        break;
    }
  }

  return {
    width,
    maxWidth: getMaxWidth(),
    handleDoubleClick,
    handleKeyDown,
    handleMouseDown,
  };
}

export const MinDrawerWidth = MinWidth;
