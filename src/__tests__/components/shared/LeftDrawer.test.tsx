import { cleanup, render, screen } from "@testing-library/react";
import React from "react";

import { LeftDrawer } from "../../../components/shared/LeftDrawer";

let mockRoute = "/";
const mockPush = jest.fn();

jest.mock("next/router", () => ({
  useRouter: () => ({ push: mockPush, route: mockRoute }),
}));

describe("LeftDrawer", () => {
  afterEach(() => {
    cleanup();
    mockRoute = "/";
  });

  function selectedButton(name: string): HTMLElement {
    return screen.getByRole("button", { name });
  }

  it("highlights Property Key Policies on the detail route", () => {
    mockRoute = "/property-key-policies/[propertyKeyPolicyId]";
    render(<LeftDrawer />);

    expect(selectedButton("Property Key Policies")).toHaveClass("Mui-selected");
    expect(selectedButton("Files")).not.toHaveClass("Mui-selected");
  });

  it("highlights Property Key Policies on the list route", () => {
    mockRoute = "/property-key-policies";
    render(<LeftDrawer />);

    expect(selectedButton("Property Key Policies")).toHaveClass("Mui-selected");
  });

  it("highlights File Collections on the detail route", () => {
    mockRoute = "/file-collections/[fileCollectionId]";
    render(<LeftDrawer />);

    expect(selectedButton("File Collections")).toHaveClass("Mui-selected");
  });

  it("highlights Scenes on the scene detail route", () => {
    mockRoute = "/scene-viewer/[sceneId]";
    render(<LeftDrawer />);

    expect(selectedButton("Scenes")).toHaveClass("Mui-selected");
  });

  it("highlights Scenes on the root route", () => {
    mockRoute = "/";
    render(<LeftDrawer />);

    expect(selectedButton("Scenes")).toHaveClass("Mui-selected");
    expect(selectedButton("Property Key Policies")).not.toHaveClass(
      "Mui-selected"
    );
  });
});
