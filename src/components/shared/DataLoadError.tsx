import { TableCell, TableRow } from "@mui/material";
import React from "react";

interface NewType {
  readonly colSpan: number;
}

export function DataLoadError({ colSpan }: NewType): JSX.Element {
  return (
    <TableRow>
      <TableCell colSpan={colSpan}>Error loading data.</TableCell>;
    </TableRow>
  );
}
