import { render, screen } from "@testing-library/react";
import React from "react";

import { AppLink } from "../../../components/shared/AppLink";
import { ResourceLink } from "../../../components/shared/ResourceLink";

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRouter = {
  push: mockPush,
  replace: mockReplace,
};

jest.mock("next/router", () => ({
  useRouter: () => mockRouter,
}));

describe("AppLink", () => {
  afterEach(() => {
    mockPush.mockClear();
    mockReplace.mockClear();
  });

  it("uses app navigation for a plain left click", () => {
    render(<AppLink href="/files">Files</AppLink>);

    const link = screen.getByRole("link", { name: "Files" });
    const defaultAllowed = link.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        button: 0,
        cancelable: true,
      })
    );

    expect(defaultAllowed).toBe(false);
    expect(mockPush).toHaveBeenCalledWith("/files", undefined, {
      locale: undefined,
      scroll: undefined,
      shallow: undefined,
    });
  });

  it("allows the browser to handle cmd-click", () => {
    render(<AppLink href="/files">Files</AppLink>);

    const link = screen.getByRole("link", { name: "Files" });
    const defaultAllowed = link.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        button: 0,
        cancelable: true,
        metaKey: true,
      })
    );

    expect(defaultAllowed).toBe(true);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("allows the browser to handle ctrl-click", () => {
    render(<AppLink href="/files">Files</AppLink>);

    const link = screen.getByRole("link", { name: "Files" });
    const defaultAllowed = link.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        button: 0,
        cancelable: true,
        ctrlKey: true,
      })
    );

    expect(defaultAllowed).toBe(true);
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe("ResourceLink", () => {
  it("uses the primary action for a plain left click", () => {
    const onPrimaryAction = jest.fn();
    render(
      <ResourceLink
        href="/files?fileId=file-1"
        onPrimaryAction={onPrimaryAction}
        primaryActionLabel="Open file"
      >
        File One
      </ResourceLink>
    );

    const link = screen.getByRole("link", { name: "Open file" });
    const defaultAllowed = link.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        button: 0,
        cancelable: true,
      })
    );

    expect(defaultAllowed).toBe(false);
    expect(onPrimaryAction).toHaveBeenCalledTimes(1);
  });

  it("allows the browser to handle cmd-click", () => {
    const onPrimaryAction = jest.fn();
    render(
      <ResourceLink
        href="/files?fileId=file-1"
        onPrimaryAction={onPrimaryAction}
        primaryActionLabel="Open file"
      >
        File One
      </ResourceLink>
    );

    const link = screen.getByRole("link", { name: "Open file" });
    const defaultAllowed = link.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        button: 0,
        cancelable: true,
        metaKey: true,
      })
    );

    expect(defaultAllowed).toBe(true);
    expect(onPrimaryAction).not.toHaveBeenCalled();
  });
});
