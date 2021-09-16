import { Add, KeyboardArrowDown, KeyboardArrowUp } from "@mui/icons-material";
import {
  Button,
  Checkbox,
  Collapse,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import React from "react";

import { toLocaleString } from "../../lib/dates";
import { Paged } from "../../lib/paging";
import { PartRevision } from "../../lib/part-revisions";
import { toPartRevisionPage } from "../../lib/part-revisions";
import { Part } from "../../lib/parts";

interface PartRowProps {
  readonly part: Part;
  readonly isSelected: boolean;
  readonly onSelected: (id: string) => void;
  readonly onCreteSceneFromRevision: (id: string) => void;
}

export default function PartRow({
  part,
  isSelected,
  onSelected,
  onCreteSceneFromRevision,
}: PartRowProps): JSX.Element {
  const row = part;
  const [open, setOpen] = React.useState<boolean>(false);

  const [revisions, setRevisions] = React.useState<
    Paged<PartRevision> | undefined
  >();

  React.useEffect(() => {
    const fetchData = async () => {
      const result = await fetch(`/api/part-revisions?partId=${part.id}`);
      setRevisions(toPartRevisionPage(await result.json()));
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
          <IconButton size="small" onClick={() => setOpen(!open)}>
            {open ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
          </IconButton>
        </TableCell>
        <TableCell padding="checkbox" onClick={() => onSelected(row.id)}>
          <Checkbox color="primary" checked={isSelected} />
        </TableCell>
        <TableCell>{row.name}</TableCell>
        <TableCell>{row.suppliedId}</TableCell>
        <TableCell>{row.id}</TableCell>
        <TableCell>{toLocaleString(row.created)}</TableCell>
      </TableRow>
      <TableRow>
        <TableCell
          colSpan={6}
          sx={{
            pb: 0,
            pt: 0,
          }}
        >
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Typography variant="subtitle1" gutterBottom component="div">
              Revisions
            </Typography>
            <Table sx={{ minWidth: 650 }}>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Supplied ID</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell></TableCell>
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
                      <TableCell>{toLocaleString(r.created)}</TableCell>
                      <TableCell align="right">
                        <Button
                          color="secondary"
                          startIcon={<Add />}
                          onClick={() => onCreteSceneFromRevision(r.id)}
                        >
                          New Scene
                        </Button>
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
