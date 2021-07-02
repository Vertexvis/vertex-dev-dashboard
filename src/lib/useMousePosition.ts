import React from "react";

export interface MousePosition {
  x: number;
  y: number;
}

export default function useMousePosition(): MousePosition | undefined {
  const [mousePosition, setMousePosition] = React.useState<
    MousePosition | undefined
  >();

  function updateMousePosition(e: MouseEvent) {
    setMousePosition({ x: e.clientX, y: e.clientY });
  }

  React.useEffect(() => {
    window.addEventListener("mousemove", updateMousePosition);

    return () => window.removeEventListener("mousemove", updateMousePosition);
  }, []);

  return mousePosition;
}
