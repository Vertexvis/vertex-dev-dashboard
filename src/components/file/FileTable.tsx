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
import { Cursors } from "@vertexvis/api-client-node";
import debounce from "lodash.debounce";
import React from "react";
import useSWR from "swr";

import { fetcher } from "../../lib/api";
import { toLocaleString } from "../../lib/dates";
import { toFilePage } from "../../lib/files";
import { SwrProps } from "../../lib/paging";
import { DataLoadError } from "../shared/DataLoadError";
import { DefaultPageSize, DefaultRowHeight } from "../shared/Layout";
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

export default function FilesTable(): JSX.Element {
  const pageSize = DefaultPageSize;
  const [curPage, setCurPage] = React.useState(0);
  const [cursor, setCursor] = React.useState<string | undefined>();
  const [cursors, setCursors] = React.useState<Cursors | undefined>();
  const [prev, setPrev] = React.useState<Record<number, string | undefined>>(
    {}
  );
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [showDialog, setShowDialog] = React.useState(false);
  const [suppliedId, setSuppliedIdFilter] = React.useState<
    string | undefined
  >();
  const [showToast, setShowToast] = React.useState(false);

  const { data, error, mutate } = useFiles({ cursor, pageSize, suppliedId });
  const page = data ? toFilePage(data) : undefined;
  const pageLength = page ? page.items.length : 0;
  const emptyRows =
    cursors?.next == null && cursors?.self == null ? 0 : pageSize - pageLength;

  const debouncedSetSuppliedIdFilter = React.useMemo(
    () => debounce(setSuppliedIdFilter, 300),
    []
  );

  React.useEffect(() => {
    if (page == null) return;

    setCursors(page.cursors ?? undefined);
  }, [page]);

  function handleSelectAll(e: React.ChangeEvent<HTMLInputElement>) {
    if (page == null) return;

    const upd = new Set<string>();
    if (e.target.checked) page.items.map((n) => upd.add(n.id));
    setSelected(upd);
  }

  function handleCheck(id: string) {
    const upd = new Set(selected);
    if (selected.has(id)) upd.delete(id);
    else upd.add(id);

    setSelected(upd);
  }

  function handleChangePage(
    _: React.MouseEvent<HTMLButtonElement> | null,
    num: number
  ) {
    if (curPage < num) {
      setPrev({ ...prev, [num - 1]: cursors?.self });
      setCursor(cursors?.next);
    }
    if (curPage > num) setCursor(prev[num]);
    setCurPage(num);
  }

  async function handleDelete() {
    setSelected(new Set());
    await fetch("/api/files", {
      body: JSON.stringify({ ids: [...selected] }),
      method: "DELETE",
    });
  }

  return (
    <>
      <Paper sx={{ m: 2 }}>
        <TableToolbar
          numSelected={selected.size}
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
              numSelected={selected.size}
              onSelectAllClick={handleSelectAll}
              rowCount={pageLength}
            />
            <TableBody>
              {error ? (
                <DataLoadError colSpan={headCells.length + 1} />
              ) : !page ? (
                <SkeletonBody
                  includeCheckbox={true}
                  numCellsPerRow={7}
                  numRows={pageSize - pageLength}
                  rowHeight={DefaultRowHeight}
                />
              ) : (
                page.items.map((row) => {
                  const isSel = selected.has(row.id);
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
                      <TableCell component="th" scope="row" padding="none">
                        {row.name}
                      </TableCell>
                      <TableCell>{row.suppliedId}</TableCell>
                      <TableCell>{row.status}</TableCell>
                      <TableCell>{row.id}</TableCell>
                      <TableCell>{toLocaleString(row.created)}</TableCell>
                      <TableCell>{toLocaleString(row.uploaded)}</TableCell>
                    </TableRow>
                  );
                })
              )}
              {emptyRows > 0 && (
                <TableRow style={{ height: DefaultRowHeight * emptyRows }}>
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
          nextIconButtonProps={{ disabled: cursors?.next == null }}
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
