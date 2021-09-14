import { Checkbox, Skeleton, TableCell, TableRow } from "@mui/material";
import React from "react";

interface Props {
  readonly includeCheckbox: boolean;
  readonly numCellsPerRow: number;
  readonly numRows: number;
  readonly rowHeight: number;
}

export function SkeletonBody({
  includeCheckbox,
  numCellsPerRow,
  numRows,
  rowHeight,
}: Props): JSX.Element {
  return (
    <>
      {Array(numRows)
        .fill(0)
        .map((_, i) => (
          <SkeletonRow
            key={i}
            includeCheckbox={includeCheckbox}
            numCellsPerRow={numCellsPerRow}
            rowHeight={rowHeight}
          />
        ))}
    </>
  );
}

function SkeletonRow({
  includeCheckbox,
  numCellsPerRow,
  rowHeight,
}: Omit<Props, "numRows">): JSX.Element {
  const role = includeCheckbox ? "checkbox" : undefined;
  return (
    <TableRow role={role} tabIndex={-1} sx={{ height: rowHeight }}>
      <TableCell padding={role}>
        {includeCheckbox ? <Checkbox disabled /> : <Skeleton />}
      </TableCell>
      {Array(includeCheckbox ? numCellsPerRow - 1 : numCellsPerRow)
        .fill(0)
        .map((_, i) => (
          <TableCell key={i}>
            <Skeleton />
          </TableCell>
        ))}
    </TableRow>
  );
}
