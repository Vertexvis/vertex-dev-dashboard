import { TableRow, TableRowProps } from "@mui/material";
import React from "react";

import { useRowDoubleClickNavigation } from "../../lib/hooks/use-row-double-click-navigation";

type ClickableTableRowProps = Omit<
  TableRowProps,
  "onClick" | "onDoubleClick" | "onKeyDown" | "tabIndex"
> & {
  /** Fired on single click / Enter — the existing drawer-select action. */
  readonly onActivate: () => void;
  /**
   * Dedicated resource page navigated to on double-click when the
   * `doubleClickNavigates` preference is on. Undefined resources no-op.
   */
  readonly href?: string;
};

/**
 * A `TableRow` wired for single-click activation (drawer) plus optional
 * double-click navigation and keyboard operability. Centralizes the
 * click/keyboard discrimination so every resource table behaves the same.
 */
export function ClickableTableRow({
  onActivate,
  href,
  children,
  ...rowProps
}: ClickableTableRowProps): JSX.Element {
  const navigation = useRowDoubleClickNavigation({ onActivate, href });

  return (
    <TableRow {...rowProps} {...navigation}>
      {children}
    </TableRow>
  );
}
