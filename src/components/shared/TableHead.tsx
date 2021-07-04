import {
  Checkbox,
  TableCell,
  TableHead as MuiTableHead,
  TableRow,
} from "@material-ui/core";
import React from "react";

export interface HeadCell {
  readonly beforeCheckbox?: boolean;
  readonly disablePadding?: boolean;
  readonly id: string;
  readonly label: string;
  readonly numeric?: boolean;
}

interface Props {
  readonly headCells: readonly HeadCell[];
  readonly numSelected: number;
  readonly onSelectAllClick: (e: React.ChangeEvent<HTMLInputElement>) => void;
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
        {renderHeadCells(headCells.filter((hc) => hc.beforeCheckbox))}
        <TableCell padding="checkbox">
          <Checkbox
            color="primary"
            indeterminate={numSelected > 0 && numSelected < rowCount}
            checked={rowCount > 0 && numSelected === rowCount}
            onChange={onSelectAllClick}
          />
        </TableCell>
        {renderHeadCells(headCells.filter((hc) => !hc.beforeCheckbox))}
      </TableRow>
    </MuiTableHead>
  );
}
function renderHeadCells(cells: readonly HeadCell[]): JSX.Element[] {
  return cells.map((hc) => (
    <TableCell
      key={hc.id}
      align={hc.numeric ? "right" : "left"}
      padding={hc.disablePadding ? "none" : "normal"}
    >
      {hc.label}
    </TableCell>
  ));
}
