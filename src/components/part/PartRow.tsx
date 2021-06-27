import {
  Checkbox,
  Collapse,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@material-ui/core";
import { KeyboardArrowDown, KeyboardArrowUp } from "@material-ui/icons";
import { PartRevisionData } from "@vertexvis/api-client-node";
import React from "react";

import { GetRes } from "../../lib/api";
import { Paged } from "../../lib/paging";
import { PartRevision } from "../../lib/part-revisions";
import { toPartRevisionPage as toPartRevisionPage } from "../../lib/part-revisions";
import { Part } from "../../lib/parts";

interface PartRowProps {
  readonly part: Part;
  readonly isSelected: boolean;
  readonly onSelected: (id: string) => void;
}

export default function PartRow({
  part,
  isSelected,
  onSelected,
}: PartRowProps): JSX.Element {
  const row = part;
  const [open, setOpen] = React.useState<boolean>(false);

  const [revisions, setRevisions] = React.useState<
    Paged<PartRevision> | undefined
  >();

  React.useEffect(() => {
    const fetchData = async () => {
      const result = await fetch(`/api/part-revisions?partId=${part.id}`);

      const j = (await result.json()) as GetRes<PartRevisionData>;

      setRevisions(toPartRevisionPage(j));
    };

    if (open) {
      fetchData();
    }
  }, [part.id, open]);

  return (
    <>
      <TableRow
        hover
        role="checkbox"
        tabIndex={-1}
        key={row.id}
        selected={isSelected}
        sx={{ "& > *": { borderBottom: "unset" } }}
      >
        <TableCell>
          <IconButton
            aria-label="expand row"
            size="small"
            onClick={() => setOpen(!open)}
          >
            {open ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
          </IconButton>
        </TableCell>
        <TableCell padding="checkbox" onClick={() => onSelected(row.id)}>
          <Checkbox color="primary" checked={isSelected} />
        </TableCell>
        <TableCell>{row.name}</TableCell>
        <TableCell>{row.suppliedId}</TableCell>
        <TableCell>{row.id}</TableCell>
        <TableCell>
          {row.created ? new Date(row.created).toLocaleString() : undefined}
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell
          colSpan={6}
          sx={{
            backgroundColor: "rgba(33, 150, 243, 0.08)",
            pb: 0,
            pt: 0,
          }}
        >
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Typography variant="subtitle1" gutterBottom component="div">
              Revisions
            </Typography>
            <Table sx={{ minWidth: 650 }} aria-label="simple table">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Supplied ID</TableCell>
                  <TableCell>Created</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {!!revisions &&
                  revisions.items.map((r) => (
                    <TableRow
                      key={r.id}
                      sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
                    >
                      <TableCell> {r.id} </TableCell>
                      <TableCell>{r.suppliedId}</TableCell>
                      <TableCell>
                        {r.created
                          ? new Date(row.created).toLocaleString()
                          : undefined}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}
