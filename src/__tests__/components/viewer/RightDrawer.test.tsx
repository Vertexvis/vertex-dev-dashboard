import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";

import { RightDrawer } from "../../../components/viewer/RightDrawer";
import { ModelViewsState } from "../../../lib/model-views";

const modelViews: ModelViewsState = {
  annotationList: [],
  modelViewList: [],
  actions: {
    fetchNextAnnotations: jest.fn(),
    fetchNextModelViews: jest.fn(),
    loadModelView: jest.fn(),
    unloadModelView: jest.fn(),
  },
};

describe("RightDrawer", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("resizes with arrow keys from the drawer's perspective", () => {
    render(
      <RightDrawer modelViews={modelViews} onViewStateSelected={jest.fn()} />,
    );

    const resizeHandle = screen.getByRole("separator", {
      name: "Resize right drawer",
    });

    expect(resizeHandle).toHaveAttribute("aria-valuenow", "320");

    fireEvent.keyDown(resizeHandle, { key: "ArrowLeft" });
    expect(resizeHandle).toHaveAttribute("aria-valuenow", "340");

    fireEvent.keyDown(resizeHandle, { key: "ArrowRight" });
    expect(resizeHandle).toHaveAttribute("aria-valuenow", "320");
  });
});
