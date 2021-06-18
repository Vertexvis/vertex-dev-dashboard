import {
  Checkbox,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TablePagination,
  TableRow,
} from "@material-ui/core";
import React from "react";

import { Paged, Scene } from "../lib/scenes";
import { HeadCell, TableHead } from "./TableHead";
import { TableToolbar } from "./TableToolbar";

interface Props {
  readonly baseUrl: string;
  readonly page: Paged<Scene>;
}

const headCells: readonly HeadCell[] = [
  {
    id: "name",
    numeric: false,
    disablePadding: true,
    label: "Name",
  },
  {
    id: "supplied-id",
    numeric: false,
    disablePadding: false,
    label: "Supplied ID",
  },
  {
    id: "id",
    numeric: false,
    disablePadding: false,
    label: "ID",
  },
  {
    id: "created",
    numeric: false,
    disablePadding: false,
    label: "Created",
  },
];

export function SceneTable({ baseUrl, page }: Props): JSX.Element {
  const [selected, setSelected] = React.useState<readonly string[]>([]);
  const [curPage, setCurPage] = React.useState(0);
  const rowsPerPage = 2;

  function handleSelectAllClick(e: React.ChangeEvent<HTMLInputElement>) {
    setSelected(e.target.checked ? page.items.map((n) => n.id) : []);
  }

  function handleClick(_e: React.MouseEvent<unknown>, id: string) {
    const selectedIndex = selected.indexOf(id);
    let upd: readonly string[] = [];

    if (selectedIndex === -1) {
      upd = upd.concat(selected, id);
    } else if (selectedIndex === 0) {
      upd = upd.concat(selected.slice(1));
    } else if (selectedIndex === selected.length - 1) {
      upd = upd.concat(selected.slice(0, -1));
    } else if (selectedIndex > 0) {
      upd = upd.concat(
        selected.slice(0, selectedIndex),
        selected.slice(selectedIndex + 1)
      );
    }

    setSelected(upd);
  }

  function handleChangePage(_e: unknown, n: number) {
    setCurPage(n);
  }

  async function handleDelete() {
    await fetch(`${baseUrl}/api/scenes`, {
      body: JSON.stringify({ ids: selected }),
      method: "DELETE",
    });
  }

  const isSelected = (name: string) => selected.indexOf(name) !== -1;

  const emptyRows =
    curPage > 0
      ? Math.max(0, (1 + curPage) * rowsPerPage - page.items.length)
      : 0;

  return (
    <Paper sx={{ m: 2 }}>
      <TableToolbar numSelected={selected.length} onDelete={handleDelete} />
      <TableContainer>
        <Table>
          <TableHead
            headCells={headCells}
            numSelected={selected.length}
            onSelectAllClick={handleSelectAllClick}
            rowCount={page.items.length}
          />
          <TableBody>
            {page.items
              .slice(curPage * rowsPerPage, curPage * rowsPerPage + rowsPerPage)
              .map((row, index) => {
                const isSel = isSelected(row.id);
                const labelId = `table-checkbox-${index}`;

                return (
                  <TableRow
                    hover
                    role="checkbox"
                    tabIndex={-1}
                    key={row.id}
                    selected={isSel}
                  >
                    <TableCell
                      padding="checkbox"
                      onClick={(e) => handleClick(e, row.id)}
                    >
                      <Checkbox color="primary" checked={isSel} />
                    </TableCell>
                    <TableCell
                      component="th"
                      id={labelId}
                      scope="row"
                      padding="none"
                    >
                      {row.name}
                    </TableCell>
                    <TableCell>{row.suppliedId}</TableCell>
                    <TableCell>{row.id}</TableCell>
                    <TableCell>
                      {row.created
                        ? new Date(row.created).toLocaleString()
                        : undefined}
                    </TableCell>
                  </TableRow>
                );
              })}
            {emptyRows > 0 && (
              <TableRow style={{ height: 53 * emptyRows }}>
                <TableCell colSpan={headCells.length + 1} />
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        rowsPerPageOptions={[]}
        component="div"
        count={page.items.length}
        rowsPerPage={rowsPerPage}
        page={curPage}
        onPageChange={handleChangePage}
      />
    </Paper>
  );
}
