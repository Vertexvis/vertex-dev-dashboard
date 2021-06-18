import {
  Checkbox,
  TableCell,
  TableHead as MuiTableHead,
  TableRow,
} from "@material-ui/core";
import React from "react";

export interface HeadCell {
  readonly disablePadding: boolean;
  readonly id: string;
  readonly label: string;
  readonly numeric: boolean;
}

interface Props {
  readonly headCells: readonly HeadCell[];
  readonly numSelected: number;
  readonly onSelectAllClick: (
    event: React.ChangeEvent<HTMLInputElement>
  ) => void;
  readonly rowCount: number;
}

export function TableHead({
  headCells,
  onSelectAllClick,
  numSelected,
  rowCount,
}: Props): JSX.Element {
  return (
    <MuiTableHead>
      <TableRow>
        <TableCell padding="checkbox">
          <Checkbox
            color="primary"
            indeterminate={numSelected > 0 && numSelected < rowCount}
            checked={rowCount > 0 && numSelected === rowCount}
            onChange={onSelectAllClick}
          />
        </TableCell>
        {headCells.map((headCell) => (
          <TableCell
            key={headCell.id}
            align={headCell.numeric ? "right" : "left"}
            padding={headCell.disablePadding ? "none" : "normal"}
          >
            {headCell.label}
          </TableCell>
        ))}
      </TableRow>
    </MuiTableHead>
  );
}
