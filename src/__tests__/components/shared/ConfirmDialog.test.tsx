import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import { ConfirmDialog } from "../../../components/shared/ConfirmDialog";

describe("ConfirmDialog", () => {
  it("renders the title and message when open", () => {
    render(
      <ConfirmDialog
        message="This cannot be undone."
        onClose={jest.fn()}
        onConfirm={jest.fn()}
        open
        title="Delete things"
      />
    );

    expect(
      screen.getByRole("heading", { name: "Delete things" })
    ).toBeInTheDocument();
    expect(screen.getByText("This cannot be undone.")).toBeInTheDocument();
  });

  it("invokes the callbacks for cancel and confirm", async () => {
    const onClose = jest.fn();
    const onConfirm = jest.fn();

    render(
      <ConfirmDialog
        cancelLabel="Cancel"
        confirmLabel="Delete"
        message="Are you sure?"
        onClose={onClose}
        onConfirm={onConfirm}
        open
        title="Confirm"
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("disables the actions while confirming", () => {
    render(
      <ConfirmDialog
        confirmLabel="Delete"
        confirming
        message="Working..."
        onClose={jest.fn()}
        onConfirm={jest.fn()}
        open
        title="Confirm"
      />
    );

    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
  });
});
