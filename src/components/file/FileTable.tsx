import { Add, Download } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  IconButton,
  Paper,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
} from "@mui/material";
import debounce from "lodash.debounce";
import React from "react";
import useSWR from "swr";

import { toLocaleString } from "../../lib/dates";
import { File, toFilePage } from "../../lib/files";
import { buildQuery, SwrProps, useCursorPagingState } from "../../lib/paging";
import { SortState, toggleSort,toSortParam } from "../../lib/sorting";
import { DataLoadError } from "../shared/DataLoadError";
import { DefaultPageSize, DefaultRowHeight } from "../shared/Layout";
import { SkeletonBody } from "../shared/SkeletonBody";
import { HeadCell, TableHead } from "../shared/TableHead";
import { TableToolbar } from "../shared/TableToolbar";
import CreateFileDialog from "./CreateFileDialog";

export const headCells: readonly HeadCell[] = [
  { id: "name", disablePadding: true, label: "Name", sortable: true },
  { id: "supplied-id", label: "Supplied ID" },
  { id: "status", label: "Status" },
  { id: "id", label: "ID" },
  { id: "created", label: "Created", sortable: true },
  { id: "uploaded", label: "Uploaded" },
  { id: "download", label: "Download" },
];

function useFiles({
  cursor,
  pageSize,
  sort,
  suppliedId,
}: SwrProps & { readonly sort: SortState }) {
  return useSWR(
    buildQuery("/api/files", {
      cursor,
      pageSize,
      sort: toSortParam(sort),
      suppliedId,
    })
  );
}

interface Props {
  readonly activeFileId?: string;
  readonly onFileSelected: (file: File) => void;
}

export default function FilesTable({
  activeFileId,
  onFileSelected,
}: Props): JSX.Element {
  const pageSize = DefaultPageSize;
  const [sort, setSort] = React.useState<SortState>({
    field: "created",
    order: "desc",
  });
  const { currentPage, cursor, cursors, handlePageChange, resetPaging, setCursors } =
    useCursorPagingState();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [showDialog, setShowDialog] = React.useState(false);
  const [suppliedId, setSuppliedIdFilter] = React.useState<
    string | undefined
  >();
  const [showToast, setShowToast] = React.useState(false);
  const [downloadError, setDownloadError] = React.useState<string>();

  const { data, error, mutate } = useFiles({
    cursor,
    pageSize,
    sort,
    suppliedId,
  });
  const page = data ? toFilePage(data) : undefined;
  const pageLength = page ? page.items.length : 0;
  const emptyRows =
    cursors?.next == null && cursors?.self == null ? 0 : pageSize - pageLength;

  const debouncedSetSuppliedIdFilter = React.useMemo(
    () =>
      debounce((value: string) => {
        resetPaging();
        setSuppliedIdFilter(value === "" ? undefined : value);
      }, 300),
    [resetPaging]
  );

  React.useEffect(() => {
    if (page == null) return;

    setCursors(page.cursors ?? undefined);
  }, [page, setCursors]);

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
    handlePageChange(num);
  }

  function handleSortChange(field: string) {
    setSort((current) => toggleSort(current, field));
    resetPaging();
  }

  async function handleDelete() {
    setSelected(new Set());
    await fetch("/api/files", {
      body: JSON.stringify({ ids: [...selected] }),
      method: "DELETE",
    });
    mutate();
  }

  async function handleDownload(id: string) {
    setDownloadError(undefined);

    const res = await fetch(
      `/api/files/${encodeURIComponent(id)}/download-url`,
      {
        method: "POST",
      }
    );

    const body = await res.json();
    if (!res.ok || body.url == null) {
      setDownloadError(
        body.message ?? "Could not create a download URL for this file."
      );
      return;
    }

    const opened = window.open(body.url as string, "_blank", "noopener");
    if (opened == null) {
      window.location.assign(body.url as string);
    }
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
            label="Supplied ID Filter (exact)"
            type="text"
            onChange={(e) => {
              debouncedSetSuppliedIdFilter(e.target.value?.trim() ?? "");
            }}
            sx={{ mt: 0, width: "20rem" }}
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
              onSortChange={handleSortChange}
              rowCount={pageLength}
              sort={sort}
            />
            <TableBody>
              {error ? (
                <DataLoadError colSpan={headCells.length + 1} />
              ) : !page ? (
                <SkeletonBody
                  includeCheckbox={true}
                  numCellsPerRow={8}
                  numRows={pageSize - pageLength}
                  rowHeight={DefaultRowHeight}
                />
              ) : (
                page.items.map((row) => {
                  const isSel = selected.has(row.id);
                  const isActive = activeFileId === row.id;

                  return (
                    <TableRow
                      hover
                      role="checkbox"
                      tabIndex={-1}
                      key={row.id}
                      selected={isSel || isActive}
                      onClick={() => onFileSelected(row)}
                    >
                      <TableCell
                        padding="checkbox"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCheck(row.id);
                        }}
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
                      <TableCell
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                      >
                        <Tooltip title="Download file">
                          <IconButton
                            aria-label={`Download ${row.name}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(row.id);
                            }}
                            size="small"
                          >
                            <Download fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
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
          page={currentPage}
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
      <Snackbar
        open={downloadError != null}
        autoHideDuration={6000}
        onClose={() => setDownloadError(undefined)}
      >
        <Alert onClose={() => setDownloadError(undefined)} severity="error">
          {downloadError}
        </Alert>
      </Snackbar>
    </>
  );
}
