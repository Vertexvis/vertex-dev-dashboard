import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";

import { useDrawerWidth } from "../../../components/viewer/useDrawerWidth";

function DrawerWidthHarness({
  anchor,
}: {
  anchor: "left" | "right";
}): JSX.Element {
  const { handleDoubleClick, handleKeyDown, handleMouseDown, maxWidth, width } =
    useDrawerWidth({
      anchor,
      defaultWidth: 320,
      storageKey: `test.${anchor}DrawerWidth`,
    });

  return (
    <>
      <div
        aria-label={`Resize ${anchor} drawer`}
        aria-orientation="vertical"
        aria-valuemax={maxWidth}
        aria-valuemin={280}
        aria-valuenow={width}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleKeyDown}
        onMouseDown={handleMouseDown}
        role="separator"
        tabIndex={0}
      />
      <output>{width}</output>
    </>
  );
}

describe("useDrawerWidth", () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1600,
    });
  });

  it("resizes and persists a left drawer", () => {
    render(<DrawerWidthHarness anchor="left" />);

    const handle = screen.getByRole("separator");
    fireEvent.mouseDown(handle);
    fireEvent.mouseMove(document, { clientX: 500 });
    fireEvent.mouseUp(document);

    expect(screen.getByRole("status")).toHaveTextContent("500");
    expect(window.localStorage.getItem("test.leftDrawerWidth")).toBe("500");
  });

  it("uses the opposite edge for a right drawer", () => {
    render(<DrawerWidthHarness anchor="right" />);

    const handle = screen.getByRole("separator");
    fireEvent.mouseDown(handle);
    fireEvent.mouseMove(document, { clientX: 1100 });
    fireEvent.mouseUp(document);

    expect(screen.getByRole("status")).toHaveTextContent("500");
    expect(window.localStorage.getItem("test.rightDrawerWidth")).toBe("500");
  });

  it("supports keyboard resizing, reset, and cancelling a drag on window blur", () => {
    render(<DrawerWidthHarness anchor="left" />);

    const handle = screen.getByRole("separator");
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(screen.getByRole("status")).toHaveTextContent("340");
    expect(window.localStorage.getItem("test.leftDrawerWidth")).toBe("340");

    fireEvent.doubleClick(handle);
    expect(screen.getByRole("status")).toHaveTextContent("320");

    fireEvent.mouseDown(handle);
    fireEvent.blur(window);
    fireEvent.mouseMove(document, { clientX: 500 });
    expect(screen.getByRole("status")).toHaveTextContent("320");
  });
});
