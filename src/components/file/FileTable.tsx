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
import debounce from "lodash.debounce";
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
  DefaultFileSort,
  FileTableRouteState,
} from "../../lib/files-route-state";
import { buildQuery, SwrProps, useCursorPagingState } from "../../lib/paging";
import { RouteStateUpdateOptions, SetRouteState } from "../../lib/route-state";
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
  readonly onRouteStateChange?: SetRouteState<FileTableRouteState>;
  readonly routeState?: FileTableRouteState;
}

function useDebouncedFilter(
  field: "fileId" | "name" | "suppliedId",
  onFilterChanged: (
    field: "fileId" | "name" | "suppliedId",
    value?: string
  ) => void
): (value: string) => void {
  const debounced = React.useMemo(
    () => debounce((value: string) => onFilterChanged(field, value), 300),
    [field, onFilterChanged]
  );

  React.useEffect(() => () => debounced.cancel(), [debounced]);
  return debounced;
}

export default function FileTable({
  activeFileId,
  onFileSelected,
  onRouteStateChange,
  routeState,
}: Props): JSX.Element {
  const routeStateEnabled = routeState != null && onRouteStateChange != null;
  const pageSize = DefaultPageSize;
  const [localSort, setLocalSort] = React.useState<SortState>(DefaultFileSort);
  const {
    currentPage: localCurrentPage,
    cursor: localCursor,
    cursors: localCursors,
    handlePageChange: handleLocalPageChange,
    resetPaging: resetLocalPaging,
    setCursors: setLocalCursors,
  } = useCursorPagingState();
  const [routeCursors, setRouteCursors] = React.useState<Cursors>();
  const [routePrevious, setRoutePrevious] = React.useState<
    Record<number, string | undefined>
  >({});
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [showDialog, setShowDialog] = React.useState(false);
  const [localNameFilter, setLocalNameFilter] = React.useState<
    string | undefined
  >();
  const [localFileIdFilter, setLocalFileIdFilter] = React.useState<
    string | undefined
  >();
  const [localSuppliedIdFilter, setLocalSuppliedIdFilter] = React.useState<
    string | undefined
  >();
  const [localCreatedAtFilters, setLocalCreatedAtFilters] =
    React.useState<CreatedAtDateRange>({});
  const [nameInput, setNameInput] = React.useState(
    () => routeState?.filters.name ?? ""
  );
  const [fileIdInput, setFileIdInput] = React.useState(
    () => routeState?.filters.fileId ?? ""
  );
  const [suppliedIdInput, setSuppliedIdInput] = React.useState(
    () => routeState?.filters.suppliedId ?? ""
  );
  const [showToast, setShowToast] = React.useState(false);
  const [downloadError, setDownloadError] = React.useState<string>();

  const sort = routeStateEnabled ? routeState.sort : localSort;
  const currentPage = routeStateEnabled
    ? routeState.paging.page
    : localCurrentPage;
  const cursor = routeStateEnabled ? routeState.paging.cursor : localCursor;
  const nameFilter = routeStateEnabled
    ? routeState.filters.name
    : localNameFilter;
  const fileIdFilter = routeStateEnabled
    ? routeState.filters.fileId
    : localFileIdFilter;
  const suppliedIdFilter = routeStateEnabled
    ? routeState.filters.suppliedId
    : localSuppliedIdFilter;
  const createdAtFilters = routeStateEnabled
    ? {
        createdAtEnd:
          routeState.filters.createdAtEnd != null
            ? toLocalDayBoundaryIso(routeState.filters.createdAtEnd, "end")
            : undefined,
        createdAtStart:
          routeState.filters.createdAtStart != null
            ? toLocalDayBoundaryIso(routeState.filters.createdAtStart, "start")
            : undefined,
      }
    : localCreatedAtFilters;

  const { data, error, mutate } = useFiles({
    createdAtEnd: createdAtFilters.createdAtEnd,
    createdAtStart: createdAtFilters.createdAtStart,
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
  const paginationCursors =
    visiblePage?.cursors ?? (routeStateEnabled ? routeCursors : localCursors);
  const emptyRows =
    paginationCursors?.next == null && paginationCursors?.self == null
      ? 0
      : pageSize - pageLength;

  const updateRouteTableState = React.useCallback(
    (
      update: React.SetStateAction<FileTableRouteState>,
      options?: RouteStateUpdateOptions
    ) => {
      if (onRouteStateChange != null) {
        void onRouteStateChange(update, options);
      }
    },
    [onRouteStateChange]
  );

  const resetRoutePagingRuntime = React.useCallback(() => {
    setRouteCursors(undefined);
    setRoutePrevious({});
  }, []);

  const handleTextFilterChange = React.useCallback(
    (field: "fileId" | "name" | "suppliedId", value?: string) => {
      const nextValue = value === "" ? undefined : value;
      if (routeStateEnabled) {
        resetRoutePagingRuntime();
        updateRouteTableState(
          (current) => ({
            ...current,
            filters: { ...current.filters, [field]: nextValue },
            paging: { cursor: undefined, page: 0 },
          }),
          { history: "replace" }
        );
        return;
      }

      resetLocalPaging();
      switch (field) {
        case "fileId":
          setLocalFileIdFilter(nextValue);
          break;
        case "name":
          setLocalNameFilter(nextValue);
          break;
        case "suppliedId":
          setLocalSuppliedIdFilter(nextValue);
          break;
      }
    },
    [
      resetLocalPaging,
      resetRoutePagingRuntime,
      routeStateEnabled,
      updateRouteTableState,
    ]
  );

  const debouncedSetNameFilter = useDebouncedFilter(
    "name",
    handleTextFilterChange
  );
  const debouncedSetFileIdFilter = useDebouncedFilter(
    "fileId",
    handleTextFilterChange
  );
  const debouncedSetSuppliedIdFilter = useDebouncedFilter(
    "suppliedId",
    handleTextFilterChange
  );

  React.useEffect(() => {
    if (!routeStateEnabled || routeState == null) return;

    setNameInput(routeState.filters.name ?? "");
    setFileIdInput(routeState.filters.fileId ?? "");
    setSuppliedIdInput(routeState.filters.suppliedId ?? "");
  }, [routeState, routeStateEnabled]);

  const routeSearchKey = routeStateEnabled
    ? JSON.stringify({ filters: routeState.filters, sort: routeState.sort })
    : "";
  const previousRouteSearchKey = React.useRef(routeSearchKey);

  React.useEffect(() => {
    if (
      routeStateEnabled &&
      previousRouteSearchKey.current !== routeSearchKey
    ) {
      previousRouteSearchKey.current = routeSearchKey;
      resetRoutePagingRuntime();
    }
  }, [routeSearchKey, routeStateEnabled, resetRoutePagingRuntime]);

  React.useEffect(() => {
    if (page == null) return;

    setLocalCursors(page.cursors ?? undefined);
    if (routeStateEnabled) {
      setRouteCursors(page.cursors ?? undefined);
    }
  }, [page, routeStateEnabled, setLocalCursors]);

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
    if (!routeStateEnabled) {
      handleLocalPageChange(num);
      return;
    }

    let nextCursor = cursor;
    if (currentPage < num) {
      nextCursor = paginationCursors?.next;
      setRoutePrevious((current) => ({
        ...current,
        [currentPage]: paginationCursors?.self,
      }));
    } else if (currentPage > num) {
      nextCursor = routePrevious[num];
    }

    updateRouteTableState(
      (current) => ({
        ...current,
        paging: { cursor: nextCursor, page: num },
      }),
      { history: "push" }
    );
  }

  function handleSortChange(field: string) {
    if (routeStateEnabled) {
      resetRoutePagingRuntime();
      updateRouteTableState(
        (current) => ({
          ...current,
          paging: { cursor: undefined, page: 0 },
          sort: toggleSort(current.sort, field),
        }),
        { history: "replace" }
      );
      return;
    }

    setLocalSort((current) => toggleSort(current, field));
    resetLocalPaging();
  }

  function handleCreatedAtChange(filters: CreatedAtDateRange) {
    if (routeStateEnabled) {
      resetRoutePagingRuntime();
      updateRouteTableState(
        (current) => ({
          ...current,
          filters: {
            ...current.filters,
            createdAtEnd: toLocalDateInputValue(filters.createdAtEnd),
            createdAtStart: toLocalDateInputValue(filters.createdAtStart),
          },
          paging: { cursor: undefined, page: 0 },
        }),
        { history: "replace" }
      );
      return;
    }

    resetLocalPaging();
    setLocalCreatedAtFilters(filters);
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
              onChange={(e) => {
                const value = e.target.value;
                setNameInput(value);
                debouncedSetNameFilter(value.trim());
              }}
              sx={{ mt: 0, width: "16rem" }}
              value={nameInput}
            />
            <TextField
              variant="standard"
              size="small"
              margin="normal"
              id="fileIdFilter"
              label="File ID"
              type="text"
              onChange={(e) => {
                const value = e.target.value;
                setFileIdInput(value);
                debouncedSetFileIdFilter(value.trim());
              }}
              sx={{ mt: 0, width: "16rem" }}
              value={fileIdInput}
            />
            <TextField
              variant="standard"
              size="small"
              margin="normal"
              id="suppliedIdFilter"
              label="Supplied ID"
              type="text"
              onChange={(e) => {
                const value = e.target.value;
                setSuppliedIdInput(value);
                debouncedSetSuppliedIdFilter(value.trim());
              }}
              sx={{ mt: 0, width: "16rem" }}
              value={suppliedIdInput}
            />
          </Box>
        </Box>
        <CreatedAtDateRangeFilter
          onChange={handleCreatedAtChange}
          value={routeStateEnabled ? routeState.filters : undefined}
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
              ...(routeStateEnabled
                ? {
                    previousButton: {
                      disabled:
                        currentPage === 0 ||
                        routePrevious[currentPage - 1] == null,
                    },
                  }
                : {}),
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
