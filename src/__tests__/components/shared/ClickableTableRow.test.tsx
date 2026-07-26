import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import { ClickableTableRow } from "../../../components/shared/ClickableTableRow";
import {
  PreferencesStorageKey,
  UserPreferencesProvider,
} from "../../../contexts/UserPreferencesContext";

const mockPush = jest.fn();

jest.mock("next/router", () => ({
  __esModule: true,
  default: { push: (...args: unknown[]) => mockPush(...args) },
}));

function renderRow(props: { onActivate: () => void; href?: string }): void {
  render(
    <UserPreferencesProvider>
      <table>
        <tbody>
          <ClickableTableRow onActivate={props.onActivate} href={props.href}>
            <td>Row label</td>
          </ClickableTableRow>
        </tbody>
      </table>
    </UserPreferencesProvider>
  );
}

function getRow(): HTMLElement {
  return screen.getByText("Row label").closest("tr") as HTMLElement;
}

describe("ClickableTableRow", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockPush.mockClear();
  });

  it("fires the activate callback on single click", async () => {
    const onActivate = jest.fn();
    renderRow({ onActivate, href: "/scene-viewer/scene-1" });

    await userEvent.click(getRow());

    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("navigates on double-click when the preference is on (default)", async () => {
    const onActivate = jest.fn();
    renderRow({ onActivate, href: "/scene-viewer/scene-1" });

    await userEvent.dblClick(getRow());

    // Single click still fired its activate callback each click.
    expect(onActivate).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/scene-viewer/scene-1");
  });

  it("does not navigate on double-click when the preference is off", async () => {
    window.localStorage.setItem(
      PreferencesStorageKey,
      JSON.stringify({ doubleClickNavigates: false })
    );
    const onActivate = jest.fn();
    renderRow({ onActivate, href: "/scene-viewer/scene-1" });

    // Wait for hydration to apply the stored preference.
    await screen.findByText("Row label");
    await userEvent.dblClick(getRow());

    expect(onActivate).toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("no-ops on double-click for a pageless row (no href)", async () => {
    const onActivate = jest.fn();
    renderRow({ onActivate });

    await userEvent.dblClick(getRow());

    expect(onActivate).toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("activates the row when Enter is pressed on the focused row", async () => {
    const onActivate = jest.fn();
    renderRow({ onActivate, href: "/scene-viewer/scene-1" });

    const row = getRow();
    row.focus();
    expect(row).toHaveFocus();

    await userEvent.keyboard("{Enter}");

    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("makes the row focusable via tabIndex", () => {
    renderRow({ onActivate: jest.fn(), href: "/scene-viewer/scene-1" });

    expect(getRow()).toHaveAttribute("tabindex", "0");
  });
});
