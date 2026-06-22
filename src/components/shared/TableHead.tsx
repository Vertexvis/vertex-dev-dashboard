import {
  Checkbox,
  TableCell,
  TableHead as MuiTableHead,
  TableRow,
  TableSortLabel,
} from "@mui/material";
import React from "react";

export interface HeadCell {
  readonly beforeCheckbox?: boolean;
  readonly disablePadding?: boolean;
  readonly id: string;
  readonly label: string;
  readonly numeric?: boolean;
  readonly sortable?: boolean;
}

export type SortOrder = "asc" | "desc";

export interface SortState {
  readonly field: string;
  readonly order: SortOrder;
}

interface Props {
  readonly headCells: readonly HeadCell[];
  readonly numSelected: number;
  readonly onSelectAllClick: (e: React.ChangeEvent<HTMLInputElement>) => void;
  readonly onSortChange?: (field: string) => void;
  readonly rowCount: number;
  readonly sort?: SortState;
}

export function TableHead({
  headCells,
  onSelectAllClick,
  onSortChange,
  numSelected,
  rowCount,
  sort,
}: Props): JSX.Element {
  return (
    <MuiTableHead>
      <TableRow>
        {renderHeadCells(
          headCells.filter((hc) => hc.beforeCheckbox),
          onSortChange,
          sort
        )}
        <TableCell padding="checkbox">
          <Checkbox
            color="primary"
            indeterminate={numSelected > 0 && numSelected < rowCount}
            checked={rowCount > 0 && numSelected === rowCount}
            onChange={onSelectAllClick}
          />
        </TableCell>
        {renderHeadCells(
          headCells.filter((hc) => !hc.beforeCheckbox),
          onSortChange,
          sort
        )}
      </TableRow>
    </MuiTableHead>
  );
}
function renderHeadCells(
  cells: readonly HeadCell[],
  onSortChange?: (field: string) => void,
  sort?: SortState
): JSX.Element[] {
  return cells.map((hc) => (
    <TableCell
      key={hc.id}
      align={hc.numeric ? "right" : "left"}
      padding={hc.disablePadding ? "none" : "normal"}
    >
      {hc.sortable && onSortChange != null ? (
        <TableSortLabel
          active={sort?.field === hc.id}
          direction={sort?.field === hc.id ? sort.order : "asc"}
          onClick={() => onSortChange(hc.id)}
        >
          {hc.label}
        </TableSortLabel>
      ) : (
        hc.label
      )}
    </TableCell>
  ));
}
