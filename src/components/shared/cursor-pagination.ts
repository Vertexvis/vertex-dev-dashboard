import { TablePaginationProps } from "@mui/material/TablePagination";

type DisplayedRows = Parameters<
  NonNullable<TablePaginationProps["labelDisplayedRows"]>
>[0];

export function formatCursorPaginationLabel(
  { from, to }: DisplayedRows,
  hasNextPage: boolean
): string {
  const visibleRange = `${from}\u2013${to}`;

  return hasNextPage ? `${visibleRange} of more than ${to}` : visibleRange;
}
