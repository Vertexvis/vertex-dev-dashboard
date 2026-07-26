import Router from "next/router";
import React from "react";

import { useOptionalUserPreferences } from "../../contexts/UserPreferencesContext";

interface UseRowDoubleClickNavigationProps {
  /** Fired on single click / Enter — the existing row-select/drawer action. */
  readonly onActivate: () => void;
  /**
   * Dedicated resource page to navigate to on double-click. When undefined
   * (resource has no dedicated page), double-click does nothing extra.
   */
  readonly href?: string;
}

export interface RowNavigationProps {
  readonly onClick: () => void;
  readonly onDoubleClick: () => void;
  readonly onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
  readonly tabIndex: number;
}

/**
 * Shared row-interaction behavior for clickable resource rows.
 *
 * - Single click: fires `onActivate` immediately (no delay) — opening the
 *   details drawer, unchanged from prior behavior.
 * - Double click: when the `doubleClickNavigates` preference is on and the
 *   resource has a dedicated `href`, navigates to that page. Otherwise no-ops
 *   (the single-click drawer already fired, which is acceptable).
 * - Keyboard: rows are focusable (`tabIndex={0}`) and Enter/Space activate the
 *   row (open the drawer), so rows are not mouse-only.
 *
 * Checkbox/action cells must continue to `stopPropagation` so they do not
 * trigger row activation.
 */
export function useRowDoubleClickNavigation({
  onActivate,
  href,
}: UseRowDoubleClickNavigationProps): RowNavigationProps {
  const { preferences } = useOptionalUserPreferences();

  const onClick = React.useCallback(() => {
    onActivate();
  }, [onActivate]);

  const onDoubleClick = React.useCallback(() => {
    if (!preferences.doubleClickNavigates || href == null) return;
    // Uses the imperative Router singleton so clickable rows never require a
    // mounted RouterContext just to render (keeps them usable in isolation).
    Router.push(href);
  }, [preferences.doubleClickNavigates, href]);

  const onKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      // Let interactive descendants (links, buttons, checkboxes) handle their
      // own keys; only activate when the row itself is focused.
      if (event.target !== event.currentTarget) return;

      event.preventDefault();
      onActivate();
    },
    [onActivate]
  );

  return { onClick, onDoubleClick, onKeyDown, tabIndex: 0 };
}
