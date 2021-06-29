import {
  Alert,
  Box,
  Button,
  Checkbox,
  Paper,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TablePagination,
  TableRow,
  TextField,
} from "@material-ui/core";
import { Add } from "@material-ui/icons";
import debounce from "lodash.debounce";
import React from "react";
import useSWR from "swr";

import { fetcher } from "../../lib/api";
import { toFilePage } from "../../lib/files";
import { SwrProps } from "../../lib/paging";
import { DataLoadError } from "../shared/DataLoadError";
import { SkeletonBody } from "../shared/SkeletonBody";
import { HeadCell, TableHead } from "../shared/TableHead";
import { TableToolbar } from "../shared/TableToolbar";
import CreateFileDialog from "./CreateFileDialog";

export const headCells: readonly HeadCell[] = [
  { id: "name", disablePadding: true, label: "Name" },
  { id: "supplied-id", label: "Supplied ID" },
  { id: "status", label: "Status" },
  { id: "id", label: "ID" },
  { id: "created", label: "Created" },
  { id: "uploaded", label: "Uploaded" },
];

function useFiles({ cursor, pageSize, suppliedId }: SwrProps) {
  return useSWR(
    `/api/files?pageSize=${pageSize}${cursor ? `&cursor=${cursor}` : ""}${
      suppliedId ? `&suppliedId=${suppliedId}` : ""
    }`,
    fetcher
  );
}

export function FilesTable(): JSX.Element {
  const pageSize = 50;
  const rowHeight = 53;
  const [selected, setSelected] = React.useState<readonly string[]>([]);
  const [curPage, setCurPage] = React.useState(0);
  const [suppliedId, setSuppliedIdFilter] = React.useState<
    string | undefined
  >();
  const [showDialog, setShowDialog] = React.useState(false);
  const [privateCursor, setPrivateCursor] = React.useState<
    string | undefined
  >();
  const [cursor, setCursor] = React.useState<string | undefined>();
  const [showToast, setShowToast] = React.useState(false);
  const { data, error, mutate } = useFiles({ cursor, pageSize, suppliedId });

  const page = data ? toFilePage(data) : undefined;
  const pageLength = page ? page.items.length : 0;
  const emptyRows = privateCursor ? 0 : pageSize - pageLength;

  const debouncedSetSuppliedIdFilter = React.useMemo(
    () => debounce(setSuppliedIdFilter, 300),
    []
  );

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
    <>
      <Paper sx={{ m: 2 }}>
        <TableToolbar
          numSelected={selected.length}
          onDelete={handleDelete}
          title="Files"
        />
        <Box
          sx={{
            px: { sm: 2 },
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <TextField
            variant="standard"
            size="small"
            margin="normal"
            id="suppliedIdFilter"
            label="Supplied ID Filter"
            type="text"
            onChange={(e) => {
              debouncedSetSuppliedIdFilter(e.target.value);
            }}
            sx={{ mt: 0 }}
          />
          <Button
            key="upload"
            variant="contained"
            startIcon={<Add />}
            onClick={() => setShowDialog(true)}
          >
            New
          </Button>
        </Box>
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
                <DataLoadError colSpan={headCells.length + 1} />
              ) : !page ? (
                <SkeletonBody
                  numCellsPerRow={7}
                  numRows={emptyRows}
                  includeCheckbox={true}
                />
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
                      <TableCell>{row.status}</TableCell>
                      <TableCell>{row.id}</TableCell>
                      <TableCell>
                        {row.created
                          ? new Date(row.created).toLocaleString()
                          : undefined}
                      </TableCell>
                      <TableCell>
                        {row.uploaded
                          ? new Date(row.uploaded).toLocaleString()
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
      <CreateFileDialog
        open={showDialog}
        onClose={() => setShowDialog(false)}
        onFileCreated={() => {
          setShowDialog(false);
          setShowToast(true);
          mutate();
        }}
      />
      <Snackbar
        open={showToast}
        autoHideDuration={6000}
        onClose={() => setShowToast(false)}
      >
        <Alert onClose={() => setShowToast(false)} severity="success">
          File created!
        </Alert>
      </Snackbar>
    </>
  );
}
