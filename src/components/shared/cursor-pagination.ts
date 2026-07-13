import { TablePaginationProps } from "@mui/material/TablePagination";

type DisplayedRows = Parameters<
  NonNullable<TablePaginationProps["labelDisplayedRows"]>
>[0];

export function formatCursorPaginationLabel(
  { from, to }: DisplayedRows,
  hasNextPage: boolean,
  visibleRowCount: number,
  isLoaded: boolean
): string {
  if (!isLoaded) return `${from}\u2013${to}`;
  if (isLoaded && visibleRowCount === 0) return "0–0";

  const visibleTo = hasNextPage ? to : from + visibleRowCount - 1;
  const visibleRange = `${from}\u2013${visibleTo}`;

  return hasNextPage
    ? `${visibleRange} of more than ${visibleTo}`
    : visibleRange;
}
