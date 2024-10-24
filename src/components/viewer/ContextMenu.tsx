import { Menu } from "@mui/material";
import { Point } from "@vertexvis/geometry";
import * as React from "react";

export interface Props {
  readonly predicate: (target: EventTarget) => boolean;
  readonly children: React.ReactNode;

  readonly onOpen?: (event: PointerEvent) => void;
}

export const ContextMenu = ({
  predicate,
  children,
  onOpen,
}: Props): JSX.Element => {
  const [open, setOpen] = React.useState(false);
  const [position, setPosition] = React.useState<Point.Point>();

  React.useEffect(() => {
    function handleContextMenu(event: MouseEvent): void {
      const validTarget = event.target != null && predicate(event.target);

      if (validTarget) {
        event.preventDefault();
      }
    }

    function handlePointerDown(event: PointerEvent): void {
      const validTarget = event.target != null && predicate(event.target);
      const validEvent = event.button === 2;

      if (validTarget && validEvent) {
        event.preventDefault();

        setPosition(Point.create(event.clientX, event.clientY));
      }
    }

    function handlePointerUp(event: PointerEvent): void {
      const validTarget = event.target != null && predicate(event.target);
      const validEvent =
        position != null &&
        Point.distance(position, Point.create(event.clientX, event.clientY)) <
          2;

      if (validTarget && validEvent) {
        event.preventDefault();

        setOpen(true);
        onOpen?.(event);
      }
    }

    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [position, predicate, onOpen]);

  return (
    <Menu
      open={open}
      anchorReference="anchorPosition"
      anchorPosition={
        position != null
          ? {
              left: position.x,
              top: position.y,
            }
          : undefined
      }
      onClose={() => setOpen(false)}
      disableAutoFocusItem
      onContextMenu={(event) => event.preventDefault()}
      onClick={() => setOpen(false)}
    >
      {children}
    </Menu>
  );
};
