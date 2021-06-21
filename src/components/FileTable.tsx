import {
  Checkbox,
  Paper,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TablePagination,
  TableRow,
} from "@material-ui/core";
import React from "react";
import useSWR from "swr";

import { toFileData as toScenePage } from "../lib/files";
import { HeadCell, TableHead } from "./TableHead";
import { TableToolbar } from "./TableToolbar";

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

async function fetcher(req: RequestInfo) {
  return (await fetch(req)).json();
}

function useFiles({
  cursor,
  pageSize,
}: {
  cursor?: string;
  pageSize: number;
}) {
  return useSWR(
    `/api/files?pageSize=${pageSize}${cursor ? `&cursor=${cursor}` : ""}`,
    fetcher
  );
}

export function FilesTable(): JSX.Element {
  const pageSize = 50;
  const rowHeight = 53;
  const [selected, setSelected] = React.useState<readonly string[]>([]);
  const [curPage, setCurPage] = React.useState(0);
  const [privateCursor, setPrivateCursor] = React.useState<
    string | undefined
  >();
  const [cursor, setCursor] = React.useState<string | undefined>();
  const { data, error } = useFiles({ cursor, pageSize });

  const page = data ? toScenePage(data) : undefined;
  const pageLength = page ? page.items.length : 0;
  const emptyRows = pageSize - pageLength;

  React.useEffect(() => {
    if (page == null) return;

    setPrivateCursor(page.cursor ?? undefined);
  }, [page]);

  function handleSelectAll(e: React.ChangeEvent<HTMLInputElement>) {
    if (page == null) return;

    setSelected(e.target.checked ? page.items.map((n) => n.id) : []);
  }

  function handleCheck(id: string) {
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
    setCursor(privateCursor);
    setCurPage(n);
  }

  async function handleDelete() {
    await fetch("/api/files", {
      body: JSON.stringify({ ids: selected }),
      method: "DELETE",
    });
  }

  const isSelected = (name: string) => selected.indexOf(name) !== -1;

  return (
    <Paper sx={{ m: 2 }}>
      <TableToolbar numSelected={selected.length} onDelete={handleDelete} title="Files" />
      <TableContainer>
        <Table>
          <TableHead
            headCells={headCells}
            numSelected={selected.length}
            onSelectAllClick={handleSelectAll}
            rowCount={pageLength}
          />
          <TableBody>
            {error ? (
              <TableRow>
                <TableCell colSpan={headCells.length + 1}>
                  Error loading data.
                </TableCell>
              </TableRow>
            ) : !page ? (
              Array(emptyRows)
                .fill(0)
                .map((_, i) => (
                  <TableRow key={i} role="checkbox" tabIndex={-1}>
                    <TableCell padding="checkbox">
                      <Checkbox disabled />
                    </TableCell>
                    <TableCell component="th" scope="row" padding="none">
                      <Skeleton />
                    </TableCell>
                    <TableCell>
                      <Skeleton />
                    </TableCell>
                    <TableCell>
                      <Skeleton />
                    </TableCell>
                    <TableCell>
                      <Skeleton />
                    </TableCell>
                  </TableRow>
                ))
            ) : (
              page.items.map((row, index) => {
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
                      onClick={() => handleCheck(row.id)}
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
              })
            )}
            {emptyRows > 0 && (
              <TableRow style={{ height: rowHeight * emptyRows }}>
                <TableCell colSpan={headCells.length + 1} />
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        rowsPerPageOptions={[]}
        component="div"
        count={-1}
        rowsPerPage={pageSize}
        page={curPage}
        onPageChange={handleChangePage}
        nextIconButtonProps={{ disabled: privateCursor == null }}
      />
    </Paper>
  );
}
