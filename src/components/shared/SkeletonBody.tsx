import { Checkbox, Skeleton, TableCell, TableRow } from "@material-ui/core";
import React from "react";

interface SkeletonBodyProps {
  readonly numRows: number;
  readonly numCellsPerRow: number;
  readonly includeCheckbox: boolean;
}

interface SkeletonRowProps {
  readonly numCells: number;
  readonly includeCheckbox: boolean;
}

export function SkeletonRow(props: SkeletonRowProps): JSX.Element {
  const renderCells = (): JSX.Element[] => {
    const items = [];
    const cells = props.includeCheckbox ? props.numCells - 1 : props.numCells;
    for (let i = 0; i < cells; i++) {
      items.push(
        <TableCell key={i}>
          <Skeleton />
        </TableCell>
      );
    }

    return items;
  };

  return (
    <TableRow
      role={props.includeCheckbox ? "checkbox" : undefined}
      tabIndex={-1}
    >
      <TableCell padding={props.includeCheckbox ? "checkbox" : undefined}>
        {props.includeCheckbox ? <Checkbox disabled /> : <Skeleton />}
      </TableCell>
      {renderCells()}
    </TableRow>
  );
}

export function SkeletonBody(props: SkeletonBodyProps): JSX.Element {
  const renderRows = (): JSX.Element[] => {
    const items = [];
    for (let i = 0; i < props.numRows - 1; i++) {
      items.push(
        <SkeletonRow
          key={i}
          includeCheckbox={props.includeCheckbox}
          numCells={props.numCellsPerRow}
        />
      );
    }

    return items;
  };

  return <>{renderRows()}</>;
}
