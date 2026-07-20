import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import React from "react";

import { ResourceLink } from "../../../components/shared/ResourceLink";

describe("ResourceLink", () => {
  it("does not bubble href-backed clicks while preserving default navigation", () => {
    const onParentClick = jest.fn();

    render(
      <div onClick={onParentClick}>
        <ResourceLink href="#resource" primaryActionLabel="Open Resource">
          Resource
        </ResourceLink>
      </div>
    );

    const link = screen.getByRole("link", { name: "Open Resource" });
    const event = createEvent.click(link);
    fireEvent(link, event);

    expect(onParentClick).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });
});
