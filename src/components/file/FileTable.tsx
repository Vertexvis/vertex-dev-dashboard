import { Add } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Paper,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TablePagination,
  TableRow,
  TextField,
} from "@mui/material";
import debounce from "lodash.debounce";
import { useRouter } from "next/router";
import React from "react";
import useSWR from "swr";

import { isErrorRes } from "../../lib/api";
import { toLocaleString } from "../../lib/dates";
import {
  File,
  FileStatusComplete,
  isCompleteFileStatus,
  normalizeFileStatus,
  toFilePage,
} from "../../lib/files";
import {
  buildQuery,
  cursorPagingStateFromQuery,
  cursorPagingStateToQuery,
  SwrProps,
  useCursorPagingState,
} from "../../lib/paging";
import { SortState, toggleSort, toSortParam } from "../../lib/sorting";
import {
  CreatedAtDateRange,
  CreatedAtDateRangeFilter,
} from "../shared/CreatedAtDateRangeFilter";
import { formatCursorPaginationLabel } from "../shared/cursor-pagination";
import { queryParamValue, updateRouterQuery } from "../../lib/url-state";
import { DataLoadError } from "../shared/DataLoadError";
import { DefaultPageSize, DefaultRowHeight } from "../shared/Layout";
import { ResourceLink } from "../shared/ResourceLink";
import { RowActionsMenu } from "../shared/RowActionsMenu";
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
  { id: "actions", label: "Actions" },
];

const UrlStatePrefix = "file";
const DefaultSort: SortState = { field: "created", order: "desc" };

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
  return isCompleteFileStatus(file.status);
}

function statusLabel(status?: string): string {
  return status ?? "N/A";
}

function statusColor(
  status?: string
): "default" | "success" | "warning" | "error" {
  switch (normalizeFileStatus(status)) {
    case FileStatusComplete:
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

type SetOptionalString = React.Dispatch<
  React.SetStateAction<string | undefined>
>;
type DateBoundary = "start" | "end";

function toLocalDayIso(value: string, boundary: DateBoundary): string {
  const [year, month, day] = value.split("-").map(Number);
  const date =
    boundary === "start"
      ? new Date(year, month - 1, day, 0, 0, 0, 0)
      : new Date(year, month - 1, day, 23, 59, 59, 999);

  return date.toISOString();
}

function toSortState(value?: string): SortState {
  switch (value) {
    case "name":
      return { field: "name", order: "asc" };
    case "-name":
      return { field: "name", order: "desc" };
    case "created":
      return { field: "created", order: "asc" };
    case "-created":
      return { field: "created", order: "desc" };
    default:
      return DefaultSort;
  }
}

function useDebouncedFilter(
  setFilter: SetOptionalString,
  resetPaging: () => void,
  onFilterChanged: (value: string | undefined) => void
): (value: string) => void {
  return React.useMemo(
    () =>
      debounce((value: string) => {
        const nextValue = value === "" ? undefined : value;
        resetPaging();
        setFilter(nextValue);
        onFilterChanged(nextValue);
      }, 300),
    [onFilterChanged, resetPaging, setFilter]
  );
}

export default function FileTable({
  activeFileId,
  onFileSelected,
}: Props): JSX.Element {
  const router = useRouter();
  const routerReady = router.isReady !== false;
  const pageSize = DefaultPageSize;
  const [sort, setSort] = React.useState<SortState>(() =>
    toSortState(queryParamValue(router.query.fileSort))
  );
  const {
    currentPage,
    cursor,
    cursors,
    getPageStateForChange,
    handlePageChange,
    resetPaging,
    setCursors,
    setPagingState,
  } = useCursorPagingState(
    cursorPagingStateFromQuery(router.query, UrlStatePrefix)
  );
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [showDialog, setShowDialog] = React.useState(false);
  const [nameFilter, setNameFilter] = React.useState<string | undefined>(() =>
    queryParamValue(router.query.fileName)
  );
  const [nameInput, setNameInput] = React.useState(
    () => queryParamValue(router.query.fileName) ?? ""
  );
  const [fileIdFilter, setFileIdFilter] = React.useState<string | undefined>(() =>
    queryParamValue(router.query.fileFilterId)
  );
  const [fileIdInput, setFileIdInput] = React.useState(
    () => queryParamValue(router.query.fileFilterId) ?? ""
  );
  const [suppliedIdFilter, setSuppliedIdFilter] = React.useState<string | undefined>(
    () => queryParamValue(router.query.fileSuppliedId)
  );
  const [suppliedIdInput, setSuppliedIdInput] = React.useState(
    () => queryParamValue(router.query.fileSuppliedId) ?? ""
  );
  const [createdAtStartDate, setCreatedAtStartDate] = React.useState(
    () => queryParamValue(router.query.fileCreatedAtStart) ?? ""
  );
  const [createdAtEndDate, setCreatedAtEndDate] = React.useState(
    () => queryParamValue(router.query.fileCreatedAtEnd) ?? ""
  );
  const [createdAtStart, setCreatedAtStart] = React.useState<
    string | undefined
  >(() => {
    const value = queryParamValue(router.query.fileCreatedAtStart);
    return value != null ? toLocalDayIso(value, "start") : undefined;
  });
  const [createdAtEnd, setCreatedAtEnd] = React.useState<string | undefined>(
    () => {
      const value = queryParamValue(router.query.fileCreatedAtEnd);
      return value != null ? toLocalDayIso(value, "end") : undefined;
    }
  );
  const [showToast, setShowToast] = React.useState(false);
  const [downloadError, setDownloadError] = React.useState<string>();
  const initializedFromQuery = React.useRef(false);

  const { data, error, mutate } = useFiles({
    createdAtEnd,
    createdAtStart,
    cursor,
    fileId: fileIdFilter,
    name: nameFilter,
    pageSize,
    sort,
    suppliedId: suppliedIdFilter,
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

  const updateFileTableQuery = React.useCallback(
    (updates: Record<string, string | undefined>) => {
      if (!routerReady) return;

      updateRouterQuery(router, updates, "replace");
    },
    [router, routerReady]
  );

  const clearPagingQuery = React.useCallback(
    () => cursorPagingStateToQuery(UrlStatePrefix),
    []
  );

  const debouncedSetNameFilter = useDebouncedFilter(
    setNameFilter,
    resetPaging,
    (value) =>
      updateFileTableQuery({
        fileName: value,
        ...clearPagingQuery(),
      })
  );
  const debouncedSetFileIdFilter = useDebouncedFilter(
    setFileIdFilter,
    resetPaging,
    (value) =>
      updateFileTableQuery({
        fileFilterId: value,
        ...clearPagingQuery(),
      })
  );
  const debouncedSetSuppliedIdFilter = useDebouncedFilter(
    setSuppliedIdFilter,
    resetPaging,
    (value) =>
      updateFileTableQuery({
        fileSuppliedId: value,
        ...clearPagingQuery(),
      })
  );

  React.useEffect(() => {
    if (!routerReady || initializedFromQuery.current) return;

    initializedFromQuery.current = true;
    setSort(toSortState(queryParamValue(router.query.fileSort)));
    const nextName = queryParamValue(router.query.fileName);
    const nextFileId = queryParamValue(router.query.fileFilterId);
    const nextSuppliedId = queryParamValue(router.query.fileSuppliedId);
    setNameFilter(nextName);
    setNameInput(nextName ?? "");
    setFileIdFilter(nextFileId);
    setFileIdInput(nextFileId ?? "");
    setSuppliedIdFilter(nextSuppliedId);
    setSuppliedIdInput(nextSuppliedId ?? "");

    const nextCreatedAtStart =
      queryParamValue(router.query.fileCreatedAtStart) ?? "";
    const nextCreatedAtEnd =
      queryParamValue(router.query.fileCreatedAtEnd) ?? "";
    setCreatedAtStartDate(nextCreatedAtStart);
    setCreatedAtEndDate(nextCreatedAtEnd);
    setCreatedAtStart(
      nextCreatedAtStart !== ""
        ? toLocalDayIso(nextCreatedAtStart, "start")
        : undefined
    );
    setCreatedAtEnd(
      nextCreatedAtEnd !== ""
        ? toLocalDayIso(nextCreatedAtEnd, "end")
        : undefined
    );
    setPagingState(cursorPagingStateFromQuery(router.query, UrlStatePrefix));
  }, [router.query, routerReady, setPagingState]);

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
    const nextPagingState = getPageStateForChange(num);
    handlePageChange(num);
    updateFileTableQuery(
      cursorPagingStateToQuery(UrlStatePrefix, nextPagingState)
    );
  }

  function handleSortChange(field: string) {
    setSort((current) => {
      const nextSort = toggleSort(current, field);
      updateFileTableQuery({
        fileSort: toSortParam(nextSort),
        ...clearPagingQuery(),
      });
      return nextSort;
    });
    resetPaging();
  }

  function handleCreatedAtChange(filters: CreatedAtDateRange) {
    resetPaging();
    const createdAtStartDate = filters.createdAtStart?.slice(0, 10) ?? "";
    const createdAtEndDate = filters.createdAtEnd?.slice(0, 10) ?? "";

    setCreatedAtStart(filters.createdAtStart);
    setCreatedAtStartDate(createdAtStartDate);
    setCreatedAtEnd(filters.createdAtEnd);
    setCreatedAtEndDate(createdAtEndDate);
    updateFileTableQuery({
      fileCreatedAtEnd: createdAtEndDate || undefined,
      fileCreatedAtStart: createdAtStartDate || undefined,
      ...clearPagingQuery(),
    });
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
            <ResourceLink
              component="a"
              disabled={!isAvailable}
              href={`/api/files/${encodeURIComponent(row.id)}/download`}
              primaryActionLabel={
                isAvailable
                  ? `Download ${row.name}`
                  : `${row.name} is not available for download`
              }
            >
              {row.name}
            </ResourceLink>
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
            <RowActionsMenu
              actions={[
                {
                  disabled: !isAvailable,
                  label: "Download file",
                  onClick: () => handleDownload(row.id),
                },
              ]}
              ariaLabel={`Actions for ${row.name}`}
            />
          </TableCell>
        </TableRow>
      );
    });
  }

  return (
    <>
      <Paper sx={{ m: 2 }}>
        <TableToolbar
          customActions={
            selected.size === 0 ? (
              <Button
                key="upload"
                variant="contained"
                startIcon={<Add />}
                onClick={() => setShowDialog(true)}
                sx={{ whiteSpace: "nowrap" }}
              >
                Add File
              </Button>
            ) : undefined
          }
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
              value={nameInput}
              onChange={(e) => {
                const value = e.target.value ?? "";
                setNameInput(value);
                debouncedSetNameFilter(value.trim());
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
              value={fileIdInput}
              onChange={(e) => {
                const value = e.target.value ?? "";
                setFileIdInput(value);
                debouncedSetFileIdFilter(value.trim());
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
              value={suppliedIdInput}
              onChange={(e) => {
                const value = e.target.value ?? "";
                setSuppliedIdInput(value);
                debouncedSetSuppliedIdFilter(value.trim());
              }}
              sx={{ mt: 0, width: "16rem" }}
            />
          </Box>
        </Box>
        <CreatedAtDateRangeFilter
          onChange={handleCreatedAtChange}
          value={{
            createdAtEnd: createdAtEndDate,
            createdAtStart: createdAtStartDate,
          }}
        />
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
          labelDisplayedRows={(displayedRows) =>
            formatCursorPaginationLabel(
              displayedRows,
              paginationCursors?.next != null,
              pageLength,
              visiblePage != null
            )
          }
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
