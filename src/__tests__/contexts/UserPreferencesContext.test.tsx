import { act, render, renderHook, screen } from "@testing-library/react";
import React from "react";

import {
  PreferencesStorageKey,
  UserPreferencesProvider,
  useUserPreferences,
} from "../../contexts/UserPreferencesContext";

function wrapper({ children }: { children: React.ReactNode }): JSX.Element {
  return <UserPreferencesProvider>{children}</UserPreferencesProvider>;
}

describe("UserPreferencesContext", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("defaults doubleClickNavigates to true when storage is empty", () => {
    const { result } = renderHook(() => useUserPreferences(), { wrapper });

    expect(result.current.preferences.doubleClickNavigates).toBe(true);
  });

  it("hydrates without crashing when localStorage is empty", () => {
    expect(() =>
      render(
        <UserPreferencesProvider>
          <span>ready</span>
        </UserPreferencesProvider>
      )
    ).not.toThrow();
    expect(screen.getByText("ready")).toBeInTheDocument();
  });

  it("reads an existing preference from localStorage on mount", () => {
    window.localStorage.setItem(
      PreferencesStorageKey,
      JSON.stringify({ doubleClickNavigates: false })
    );

    const { result } = renderHook(() => useUserPreferences(), { wrapper });

    expect(result.current.preferences.doubleClickNavigates).toBe(false);
    expect(result.current.hydrated).toBe(true);
  });

  it("persists updates to localStorage and round-trips the value", () => {
    const { result } = renderHook(() => useUserPreferences(), { wrapper });

    act(() => {
      result.current.setPreference("doubleClickNavigates", false);
    });

    expect(result.current.preferences.doubleClickNavigates).toBe(false);
    expect(
      JSON.parse(window.localStorage.getItem(PreferencesStorageKey) ?? "{}")
    ).toEqual({ doubleClickNavigates: false });
  });

  it("ignores malformed stored preferences and falls back to defaults", () => {
    window.localStorage.setItem(PreferencesStorageKey, "not json");

    const { result } = renderHook(() => useUserPreferences(), { wrapper });

    expect(result.current.preferences.doubleClickNavigates).toBe(true);
  });

  it("throws when used outside a provider", () => {
    const spy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    expect(() => renderHook(() => useUserPreferences())).toThrow(
      /UserPreferencesProvider/
    );
    spy.mockRestore();
  });
});
