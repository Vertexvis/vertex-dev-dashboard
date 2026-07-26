import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import { SettingsDrawer } from "../../../components/shared/SettingsDrawer";
import {
  PreferencesStorageKey,
  UserPreferencesProvider,
} from "../../../contexts/UserPreferencesContext";

function Harness(): JSX.Element {
  const [open, setOpen] = React.useState(false);
  return (
    <UserPreferencesProvider>
      <button onClick={() => setOpen(true)}>Open settings</button>
      <SettingsDrawer open={open} onClose={() => setOpen(false)} />
    </UserPreferencesProvider>
  );
}

describe("SettingsDrawer", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("opens from a button and shows the settings heading", async () => {
    render(<Harness />);

    expect(
      screen.queryByRole("heading", { name: "Settings" })
    ).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Open settings" })
    );

    expect(
      screen.getByRole("heading", { name: "Settings" })
    ).toBeInTheDocument();
  });

  it("reflects the current preference (defaults on)", () => {
    render(
      <UserPreferencesProvider>
        <SettingsDrawer open onClose={jest.fn()} />
      </UserPreferencesProvider>
    );

    expect(
      screen.getByRole("checkbox", {
        name: "Open the resource page on double-click",
      })
    ).toBeChecked();
  });

  it("toggles the preference off and persists it", async () => {
    render(
      <UserPreferencesProvider>
        <SettingsDrawer open onClose={jest.fn()} />
      </UserPreferencesProvider>
    );

    const toggle = screen.getByRole("checkbox", {
      name: "Open the resource page on double-click",
    });
    expect(toggle).toBeChecked();

    await userEvent.click(toggle);

    expect(toggle).not.toBeChecked();
    expect(
      JSON.parse(window.localStorage.getItem(PreferencesStorageKey) ?? "{}")
    ).toEqual({ doubleClickNavigates: false });
  });
});
