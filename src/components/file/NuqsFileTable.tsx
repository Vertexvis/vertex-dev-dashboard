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
import { Cursors } from "@vertexvis/api-client-node";
import { debounce, Nullable, useQueryStates } from "nuqs";
import React from "react";
import useSWR from "swr";

import { isErrorRes } from "../../lib/api";
import {
  toLocalDateInputValue,
  toLocalDayBoundaryIso,
  toLocaleString,
} from "../../lib/dates";
import {
  File,
  FileStatusComplete,
  isCompleteFileStatus,
  normalizeFileStatus,
  toFilePage,
} from "../../lib/files";
import {
  fileTableParsers,
  FileTableState,
  fileTableUrlKeys,
} from "../../lib/files-nuqs-state";
import { buildQuery, SwrProps } from "../../lib/paging";
import { SortState, toggleSort, toSortParam } from "../../lib/sorting";
import {
  CreatedAtDateRange,
  CreatedAtDateRangeFilter,
} from "../shared/CreatedAtDateRangeFilter";
import { formatCursorPaginationLabel } from "../shared/cursor-pagination";
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

const FilterDebounceMs = 300;

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

export default function NuqsFileTable({
  activeFileId,
  onFileSelected,
}: Props): JSX.Element {
  const pageSize = DefaultPageSize;
  const [state, setState] = useQueryStates(fileTableParsers, {
    urlKeys: fileTableUrlKeys,
  });
  const [cachedCursors, setCachedCursors] = React.useState<Cursors>();
  const [previousCursors, setPreviousCursors] = React.useState<
    Record<number, string | undefined>
  >({});
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [showDialog, setShowDialog] = React.useState(false);
  const [showToast, setShowToast] = React.useState(false);
  const [downloadError, setDownloadError] = React.useState<string>();

  const { data, error, mutate } = useFiles({
    createdAtEnd:
      state.createdAtEnd != null
        ? toLocalDayBoundaryIso(state.createdAtEnd, "end")
        : undefined,
    createdAtStart:
      state.createdAtStart != null
        ? toLocalDayBoundaryIso(state.createdAtStart, "start")
        : undefined,
    cursor: state.cursor ?? undefined,
    fileId: state.filterId?.trim() || undefined,
    name: state.name?.trim() || undefined,
    pageSize,
    sort: state.sort,
    suppliedId: state.suppliedId?.trim() || undefined,
  });
  const loadError = error ?? (isErrorRes(data) ? data : undefined);
  const page = data && !isErrorRes(data) ? toFilePage(data) : undefined;
  const visiblePage = page;
  const pageLength = visiblePage ? visiblePage.items.length : 0;
  const paginationCursors = visiblePage?.cursors ?? cachedCursors;
  const emptyRows =
    paginationCursors?.next == null && paginationCursors?.self == null
      ? 0
      : pageSize - pageLength;

  const resetPagingCache = React.useCallback(() => {
    setCachedCursors(undefined);
    setPreviousCursors({});
  }, []);

  function handleTextFilterChange(
    field: "filterId" | "name" | "suppliedId",
    value: string
  ) {
    const patch: Partial<Nullable<FileTableState>> = {
      cursor: null,
      page: null,
    };
    patch[field] = value === "" ? null : value;

    resetPagingCache();
    void setState(patch, { limitUrlUpdates: debounce(FilterDebounceMs) });
  }

  const searchKey = JSON.stringify({
    createdAtEnd: state.createdAtEnd,
    createdAtStart: state.createdAtStart,
    filterId: state.filterId,
    name: state.name,
    sort: state.sort,
    suppliedId: state.suppliedId,
  });
  const previousSearchKey = React.useRef(searchKey);

  React.useEffect(() => {
    if (previousSearchKey.current !== searchKey) {
      previousSearchKey.current = searchKey;
      resetPagingCache();
    }
  }, [searchKey, resetPagingCache]);

  React.useEffect(() => {
    if (page == null) return;

    setCachedCursors(page.cursors ?? undefined);
  }, [page]);

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
    let nextCursor = state.cursor;
    if (state.page < num) {
      nextCursor = paginationCursors?.next ?? null;
      setPreviousCursors((current) => ({
        ...current,
        [state.page]: paginationCursors?.self,
      }));
    } else if (state.page > num) {
      nextCursor = previousCursors[num] ?? null;
    }

    void setState({ cursor: nextCursor, page: num }, { history: "push" });
  }

  function handleSortChange(field: string) {
    resetPagingCache();
    void setState((current) => ({
      cursor: null,
      page: null,
      sort: toggleSort(current.sort, field),
    }));
  }

  function handleCreatedAtChange(filters: CreatedAtDateRange) {
    resetPagingCache();
    void setState({
      createdAtEnd: toLocalDateInputValue(filters.createdAtEnd) || null,
      createdAtStart: toLocalDateInputValue(filters.createdAtStart) || null,
      cursor: null,
      page: null,
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
              onChange={(e) => handleTextFilterChange("name", e.target.value)}
              sx={{ mt: 0, width: "16rem" }}
              value={state.name ?? ""}
            />
            <TextField
              variant="standard"
              size="small"
              margin="normal"
              id="fileIdFilter"
              label="File ID"
              type="text"
              onChange={(e) =>
                handleTextFilterChange("filterId", e.target.value)
              }
              sx={{ mt: 0, width: "16rem" }}
              value={state.filterId ?? ""}
            />
            <TextField
              variant="standard"
              size="small"
              margin="normal"
              id="suppliedIdFilter"
              label="Supplied ID"
              type="text"
              onChange={(e) =>
                handleTextFilterChange("suppliedId", e.target.value)
              }
              sx={{ mt: 0, width: "16rem" }}
              value={state.suppliedId ?? ""}
            />
          </Box>
        </Box>
        <CreatedAtDateRangeFilter
          onChange={handleCreatedAtChange}
          value={{
            createdAtEnd: state.createdAtEnd ?? undefined,
            createdAtStart: state.createdAtStart ?? undefined,
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
              sort={state.sort}
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
          page={state.page}
          onPageChange={handleChangePage}
          slotProps={{
            actions: {
              nextButton: { disabled: paginationCursors?.next == null },
              previousButton: {
                disabled:
                  state.page === 0 || previousCursors[state.page - 1] == null,
              },
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
