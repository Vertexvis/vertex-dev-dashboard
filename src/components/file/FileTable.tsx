import { Add, Download } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
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

import { isErrorRes } from "../../lib/api";
import { toLocaleString } from "../../lib/dates";
import { File, toFilePage } from "../../lib/files";
import { buildQuery, SwrProps, useCursorPagingState } from "../../lib/paging";
import { SortState, toggleSort, toSortParam } from "../../lib/sorting";
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

interface UseFilesProps extends SwrProps {
  readonly createdAtEnd?: string;
  readonly createdAtStart?: string;
  readonly fileId?: string;
  readonly name?: string;
  readonly sort?: SortState;
  readonly suppliedId?: string;
}

function useFiles({
  createdAtEnd,
  createdAtStart,
  cursor,
  fileId,
  name,
  pageSize,
  sort,
  suppliedId,
}: UseFilesProps) {
  return useSWR(
    buildQuery("/api/files", {
      createdAtEnd,
      createdAtStart,
      cursor,
      fileId,
      name,
      pageSize,
      sort: sort != null ? toSortParam(sort) : undefined,
      suppliedId,
    })
  );
}

function isFileAvailable(file: File): boolean {
  const status = normalizeStatus(file.status);

  return status === "complete";
}

function normalizeStatus(status?: string): string | undefined {
  return status?.toLowerCase();
}

function statusLabel(status?: string): string {
  return status ?? "N/A";
}

function statusColor(
  status?: string
): "default" | "success" | "warning" | "error" {
  switch (normalizeStatus(status)) {
    case "complete":
    case "ready":
      return "success";
    case "pending":
      return "warning";
    case "error":
    case "failed":
      return "error";
    default:
      return "default";
  }
}

interface Props {
  readonly activeFileId?: string;
  readonly onFileSelected: (file: File) => void;
}

type SetOptionalString = React.Dispatch<React.SetStateAction<string | undefined>>;
type DateBoundary = "start" | "end";

function toLocalDayIso(value: string, boundary: DateBoundary): string {
  const [year, month, day] = value.split("-").map(Number);
  const date =
    boundary === "start"
      ? new Date(year, month - 1, day, 0, 0, 0, 0)
      : new Date(year, month - 1, day, 23, 59, 59, 999);

  return date.toISOString();
}

function useDebouncedFilter(
  setFilter: SetOptionalString,
  resetPaging: () => void
): (value: string) => void {
  return React.useMemo(
    () =>
      debounce((value: string) => {
        resetPaging();
        setFilter(value === "" ? undefined : value);
      }, 300),
    [resetPaging, setFilter]
  );
}

export default function FileTable({
  activeFileId,
  onFileSelected,
}: Props): JSX.Element {
  const pageSize = DefaultPageSize;
  const [sort, setSort] = React.useState<SortState>({
    field: "created",
    order: "desc",
  });
  const {
    currentPage,
    cursor,
    cursors,
    handlePageChange,
    resetPaging,
    setCursors,
  } = useCursorPagingState();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [showDialog, setShowDialog] = React.useState(false);
  const [name, setNameFilter] = React.useState<string | undefined>();
  const [fileId, setFileIdFilter] = React.useState<string | undefined>();
  const [suppliedId, setSuppliedIdFilter] = React.useState<
    string | undefined
  >();
  const [createdAtStart, setCreatedAtStart] = React.useState<
    string | undefined
  >();
  const [createdAtEnd, setCreatedAtEnd] = React.useState<string | undefined>();
  const [showToast, setShowToast] = React.useState(false);
  const [downloadError, setDownloadError] = React.useState<string>();

  const { data, error, mutate } = useFiles({
    createdAtEnd,
    createdAtStart,
    cursor,
    fileId,
    name,
    pageSize,
    sort,
    suppliedId,
  });
  const loadError = error ?? (isErrorRes(data) ? data : undefined);
  const page = data && !isErrorRes(data) ? toFilePage(data) : undefined;
  const visiblePage = page;
  const pageLength = visiblePage ? visiblePage.items.length : 0;
  const paginationCursors = visiblePage?.cursors ?? cursors;
  const emptyRows =
    paginationCursors?.next == null && paginationCursors?.self == null
      ? 0
      : pageSize - pageLength;

  const debouncedSetNameFilter = useDebouncedFilter(setNameFilter, resetPaging);
  const debouncedSetFileIdFilter = useDebouncedFilter(
    setFileIdFilter,
    resetPaging
  );
  const debouncedSetSuppliedIdFilter = useDebouncedFilter(
    setSuppliedIdFilter,
    resetPaging
  );

  React.useEffect(() => {
    if (page == null) return;

    setCursors(page.cursors ?? undefined);
  }, [page, setCursors]);

  function handleSelectAll(e: React.ChangeEvent<HTMLInputElement>) {
    if (visiblePage == null) return;

    const upd = new Set<string>();
    if (e.target.checked) visiblePage.items.forEach((n) => upd.add(n.id));
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

  let tableRows: React.ReactNode;
  if (loadError) {
    tableRows = <DataLoadError colSpan={headCells.length + 1} />;
  } else if (!visiblePage) {
    tableRows = (
      <SkeletonBody
        includeCheckbox={true}
        numCellsPerRow={8}
        numRows={pageSize - pageLength}
        rowHeight={DefaultRowHeight}
      />
    );
  } else {
    tableRows = visiblePage.items.map((row) => {
      const isSel = selected.has(row.id);
      const isActive = activeFileId === row.id;
      const isAvailable = isFileAvailable(row);

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
            <Checkbox
              color="primary"
              checked={isSel}
              inputProps={{
                "aria-label": `Select ${row.name ?? row.id}`,
              }}
            />
          </TableCell>
          <TableCell component="th" scope="row" padding="none">
            {row.name}
          </TableCell>
          <TableCell>{row.suppliedId}</TableCell>
          <TableCell>
            <Chip
              color={statusColor(row.status)}
              label={statusLabel(row.status)}
              size="small"
              sx={{ fontWeight: 600, textTransform: "uppercase" }}
              variant="outlined"
            />
          </TableCell>
          <TableCell>{row.id}</TableCell>
          <TableCell>{toLocaleString(row.created)}</TableCell>
          <TableCell>{toLocaleString(row.uploaded)}</TableCell>
          <TableCell
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <Tooltip
              title={
                isAvailable ? "Download file" : "File is not available yet"
              }
            >
              <span>
                <IconButton
                  aria-label={`Download ${row.name}`}
                  disabled={!isAvailable}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isAvailable) handleDownload(row.id);
                  }}
                  size="small"
                >
                  <Download fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </TableCell>
        </TableRow>
      );
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
            gap: 2,
            flexWrap: "wrap",
          }}
        >
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", flex: 1 }}>
            <TextField
              variant="standard"
              size="small"
              margin="normal"
              id="nameFilter"
              label="Name"
              type="text"
              onChange={(e) => {
                debouncedSetNameFilter(e.target.value?.trim() ?? "");
              }}
              sx={{ mt: 0, width: "16rem" }}
            />
            <TextField
              variant="standard"
              size="small"
              margin="normal"
              id="fileIdFilter"
              label="File ID"
              type="text"
              onChange={(e) => {
                debouncedSetFileIdFilter(e.target.value?.trim() ?? "");
              }}
              sx={{ mt: 0, width: "16rem" }}
            />
            <TextField
              variant="standard"
              size="small"
              margin="normal"
              id="suppliedIdFilter"
              label="Supplied ID"
              type="text"
              onChange={(e) => {
                debouncedSetSuppliedIdFilter(e.target.value?.trim() ?? "");
              }}
              sx={{ mt: 0, width: "16rem" }}
            />
            <TextField
              variant="standard"
              size="small"
              margin="normal"
              id="createdAtStart"
              label="Created From"
              type="date"
              InputLabelProps={{ shrink: true }}
              onChange={(e) => {
                resetPaging();
                setCreatedAtStart(
                  e.target.value
                    ? toLocalDayIso(e.target.value, "start")
                    : undefined
                );
              }}
              sx={{ mt: 0, width: "12rem" }}
            />
            <TextField
              variant="standard"
              size="small"
              margin="normal"
              id="createdAtEnd"
              label="Created To"
              type="date"
              InputLabelProps={{ shrink: true }}
              onChange={(e) => {
                resetPaging();
                setCreatedAtEnd(
                  e.target.value
                    ? toLocalDayIso(e.target.value, "end")
                    : undefined
                );
              }}
              sx={{ mt: 0, width: "12rem" }}
            />
          </Box>
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
              {tableRows}
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
          slotProps={{
            actions: {
              nextButton: { disabled: paginationCursors?.next == null },
            },
          }}
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
