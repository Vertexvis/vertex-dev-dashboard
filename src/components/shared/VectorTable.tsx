import {
  Table,
  TableBody,
  TableCell,
  TableRow,
  Typography,
} from "@mui/material";
import { Vector3 } from "@vertexvis/geometry";
import React from "react";

export function VectorTable({
  vector,
}: {
  vector: Vector3.Vector3;
}): JSX.Element {
  return (
    <Table size="small" sx={{ "&:last-child td": { border: 0 } }}>
      <TableBody>
        <TableRow>
          <TableCell>
            <Typography variant="subtitle2">X</Typography>
          </TableCell>
          <TableCell>
            <Typography variant="body2">{vector.x.toFixed(2)}</Typography>
          </TableCell>
        </TableRow>
        <TableRow>
          <TableCell>
            <Typography variant="subtitle2">Y</Typography>
          </TableCell>
          <TableCell>
            <Typography variant="body2">{vector.y.toFixed(2)}</Typography>
          </TableCell>
        </TableRow>
        <TableRow>
          <TableCell>
            <Typography variant="subtitle2">Z</Typography>
          </TableCell>
          <TableCell>
            <Typography variant="body2">{vector.z.toFixed(2)}</Typography>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}
