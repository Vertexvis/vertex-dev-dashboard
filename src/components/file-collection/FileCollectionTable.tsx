import {
  Alert,
  Box,
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
} from "@mui/material";
import debounce from "lodash.debounce";
import { useRouter } from "next/router";
import React from "react";
import useSWR from "swr";

import {
  toLocalDateInputValue,
  toLocalDayBoundaryIso,
  toLocaleString,
} from "../../lib/dates";
import {
  FileCollection,
  toFileCollectionPage,
} from "../../lib/file-collections";
import {
  buildQuery,
  cursorPagingStateFromQuery,
  cursorPagingStateToQuery,
  SwrProps,
  useCursorPagingState,
} from "../../lib/paging";
import { SortState, toggleSort, toSortParam } from "../../lib/sorting";
import { queryParamValue, updateRouterQuery } from "../../lib/url-state";
import {
  CreatedAtDateRange,
  CreatedAtDateRangeFilter,
} from "../shared/CreatedAtDateRangeFilter";
import { formatCursorPaginationLabel } from "../shared/cursor-pagination";
import { DataLoadError } from "../shared/DataLoadError";
import { DefaultPageSize, DefaultRowHeight } from "../shared/Layout";
import { ResourceLink } from "../shared/ResourceLink";
import { SkeletonBody } from "../shared/SkeletonBody";
import { HeadCell, TableHead } from "../shared/TableHead";
import { TableToolbar } from "../shared/TableToolbar";

export const headCells: readonly HeadCell[] = [
  { id: "name", disablePadding: true, label: "Name", sortable: true },
  { id: "id", label: "ID" },
  { id: "supplied-id", label: "Supplied ID" },
  { id: "created", label: "Created At", sortable: true },
];

const UrlStatePrefix = "fileCollection";

interface UseFileCollectionsProps extends SwrProps {
  readonly createdAtEnd?: string;
  readonly createdAtStart?: string;
  readonly sort?: SortState<FileCollectionSortField>;
  readonly name?: string;
}

type FileCollectionSortField = "created" | "name";

function isFileCollectionSortField(
  field: string
): field is FileCollectionSortField {
  return field === "created" || field === "name";
}

function toFileCollectionSortState(
  value?: string
): SortState<FileCollectionSortField> | undefined {
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
      return undefined;
  }
}

function fileCollectionPath(fileCollectionId: string): string {
  return `/file-collections/${encodeURIComponent(fileCollectionId)}`;
}

function useFileCollections({
  createdAtEnd,
  createdAtStart,
  cursor,
  name,
  pageSize,
  sort,
  suppliedId,
}: UseFileCollectionsProps) {
  return useSWR(
    buildQuery("/api/file-collections", {
      createdAtEnd,
      createdAtStart,
      cursor,
      name,
      pageSize,
      sort: sort != null ? toSortParam(sort) : undefined,
      suppliedId,
    })
  );
}

interface Props {
  readonly activeFileCollectionId?: string;
  readonly onFileCollectionSelected?: (fileCollection: FileCollection) => void;
}

export default function FileCollectionTable({
  activeFileCollectionId,
  onFileCollectionSelected,
}: Props): JSX.Element {
  const router = useRouter();
  const routerReady = router.isReady !== false;
  const pageSize = DefaultPageSize;
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
  const [sort, setSort] = React.useState<
    SortState<FileCollectionSortField> | undefined
  >(() =>
    toFileCollectionSortState(queryParamValue(router.query.fileCollectionSort))
  );
  const [name, setName] = React.useState<string | undefined>(() =>
    queryParamValue(router.query.fileCollectionName)
  );
  const [nameInput, setNameInput] = React.useState(
    () => queryParamValue(router.query.fileCollectionName) ?? ""
  );
  const [suppliedId, setSuppliedId] = React.useState<string | undefined>(() =>
    queryParamValue(router.query.fileCollectionSuppliedId)
  );
  const [suppliedIdInput, setSuppliedIdInput] = React.useState(
    () => queryParamValue(router.query.fileCollectionSuppliedId) ?? ""
  );
  const [createdAtStartDate, setCreatedAtStartDate] = React.useState(
    () => queryParamValue(router.query.fileCollectionCreatedAtStart) ?? ""
  );
  const [createdAtEndDate, setCreatedAtEndDate] = React.useState(
    () => queryParamValue(router.query.fileCollectionCreatedAtEnd) ?? ""
  );
  const [createdAtStart, setCreatedAtStart] = React.useState<
    string | undefined
  >(() => {
    const value = queryParamValue(router.query.fileCollectionCreatedAtStart);
    return value != null ? toLocalDayBoundaryIso(value, "start") : undefined;
  });
  const [createdAtEnd, setCreatedAtEnd] = React.useState<string | undefined>(
    () => {
      const value = queryParamValue(router.query.fileCollectionCreatedAtEnd);
      return value != null ? toLocalDayBoundaryIso(value, "end") : undefined;
    }
  );
  const [deleteError, setDeleteError] = React.useState<string>();
  const initializedFromQuery = React.useRef(false);

  const { data, error, mutate } = useFileCollections({
    createdAtEnd,
    createdAtStart,
    cursor,
    name,
    pageSize,
    sort,
    suppliedId,
  });
  const page = data ? toFileCollectionPage(data) : undefined;
  const pageLength = page ? page.items.length : 0;
  const emptyRows =
    cursors?.next == null && cursors?.self == null ? 0 : pageSize - pageLength;

  const updateFileCollectionTableQuery = React.useCallback(
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

  const debouncedSetNameFilter = React.useMemo(
    () =>
      debounce((value: string) => {
        const nextValue = value === "" ? undefined : value;
        resetPaging();
        setName(nextValue);
        updateFileCollectionTableQuery({
          fileCollectionName: nextValue,
          ...clearPagingQuery(),
        });
      }, 300),
    [clearPagingQuery, resetPaging, updateFileCollectionTableQuery]
  );

  const debouncedSetSuppliedIdFilter = React.useMemo(
    () =>
      debounce((value: string) => {
        const nextValue = value === "" ? undefined : value;
        resetPaging();
        setSuppliedId(nextValue);
        updateFileCollectionTableQuery({
          fileCollectionSuppliedId: nextValue,
          ...clearPagingQuery(),
        });
      }, 300),
    [clearPagingQuery, resetPaging, updateFileCollectionTableQuery]
  );

  React.useEffect(() => {
    if (!routerReady || initializedFromQuery.current) return;

    initializedFromQuery.current = true;
    setSort(
      toFileCollectionSortState(
        queryParamValue(router.query.fileCollectionSort)
      )
    );
    const nextName = queryParamValue(router.query.fileCollectionName);
    const nextSuppliedId = queryParamValue(
      router.query.fileCollectionSuppliedId
    );
    setName(nextName);
    setNameInput(nextName ?? "");
    setSuppliedId(nextSuppliedId);
    setSuppliedIdInput(nextSuppliedId ?? "");
    const nextCreatedAtStart =
      queryParamValue(router.query.fileCollectionCreatedAtStart) ?? "";
    const nextCreatedAtEnd =
      queryParamValue(router.query.fileCollectionCreatedAtEnd) ?? "";
    setCreatedAtStartDate(nextCreatedAtStart);
    setCreatedAtEndDate(nextCreatedAtEnd);
    setCreatedAtStart(
      nextCreatedAtStart !== ""
        ? toLocalDayBoundaryIso(nextCreatedAtStart, "start")
        : undefined
    );
    setCreatedAtEnd(
      nextCreatedAtEnd !== ""
        ? toLocalDayBoundaryIso(nextCreatedAtEnd, "end")
        : undefined
    );
    setPagingState(cursorPagingStateFromQuery(router.query, UrlStatePrefix));
  }, [router.query, routerReady, setPagingState]);

  React.useEffect(() => {
    if (page == null) return;

    setCursors(page.cursors ?? undefined);
  }, [page, setCursors]);

  function handleCreatedAtChange(filters: CreatedAtDateRange) {
    resetPaging();
    const createdAtStartDate = toLocalDateInputValue(filters.createdAtStart);
    const createdAtEndDate = toLocalDateInputValue(filters.createdAtEnd);
    setCreatedAtStart(filters.createdAtStart);
    setCreatedAtStartDate(createdAtStartDate);
    setCreatedAtEnd(filters.createdAtEnd);
    setCreatedAtEndDate(createdAtEndDate);
    updateFileCollectionTableQuery({
      fileCollectionCreatedAtEnd: createdAtEndDate || undefined,
      fileCollectionCreatedAtStart: createdAtStartDate || undefined,
      ...clearPagingQuery(),
    });
  }

  function handleSortChange(field: string) {
    if (!isFileCollectionSortField(field)) return;

    setSort((current) => {
      const nextSort: SortState<FileCollectionSortField> =
        current == null ? { field, order: "asc" } : toggleSort(current, field);
      updateFileCollectionTableQuery({
        fileCollectionSort: toSortParam(nextSort),
        ...clearPagingQuery(),
      });
      return nextSort;
    });
    resetPaging();
  }

  function handleSelectAll(e: React.ChangeEvent<HTMLInputElement>) {
    if (page == null) return;

    const upd = new Set<string>();
    if (e.target.checked) page.items.forEach((n) => upd.add(n.id));
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
    updateFileCollectionTableQuery(
      cursorPagingStateToQuery(UrlStatePrefix, nextPagingState)
    );
  }

  async function handleDelete() {
    setDeleteError(undefined);
    const ids = [...selected];
    setSelected(new Set());

    const res = await fetch("/api/file-collections", {
      body: JSON.stringify({ ids }),
      method: "DELETE",
    });

    if (!res.ok) {
      const body = await res.json();
      setDeleteError(
        body.message ?? "Could not delete the selected file collections."
      );
      setSelected(new Set(ids));
      return;
    }

    mutate();
  }

  function handleOpenFileCollection(fileCollectionId: string) {
    router.push(fileCollectionPath(fileCollectionId));
  }

  let tableRows: React.ReactNode;
  if (error) {
    tableRows = <DataLoadError colSpan={headCells.length + 1} />;
  } else if (!page) {
    tableRows = (
      <SkeletonBody
        includeCheckbox={true}
        numCellsPerRow={headCells.length}
        numRows={pageSize - pageLength}
        rowHeight={DefaultRowHeight}
      />
    );
  } else {
    tableRows = page.items.map((row) => {
      const isSel = selected.has(row.id);
      const isActive = activeFileCollectionId === row.id;

      return (
        <TableRow
          hover
          role="checkbox"
          tabIndex={-1}
          key={row.id}
          selected={isSel || isActive}
          onClick={() => onFileCollectionSelected?.(row)}
        >
          <TableCell
            padding="checkbox"
            style={{ cursor: "default" }}
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
              href={fileCollectionPath(row.id)}
              onPrimaryAction={() => handleOpenFileCollection(row.id)}
              primaryActionLabel={`Open ${row.name}`}
            >
              {row.name}
            </ResourceLink>
          </TableCell>
          <TableCell>{row.id}</TableCell>
          <TableCell>{row.suppliedId}</TableCell>
          <TableCell>{toLocaleString(row.created)}</TableCell>
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
          title="File Collections"
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
              {page?.items.length === 0 && (
                <TableRow style={{ height: DefaultRowHeight }}>
                  <TableCell colSpan={headCells.length + 1}>
                    No file collections found.
                  </TableCell>
                </TableRow>
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
          labelDisplayedRows={(displayedRows) =>
            formatCursorPaginationLabel(
              displayedRows,
              cursors?.next != null,
              pageLength,
              page != null
            )
          }
          rowsPerPage={pageSize}
          page={currentPage}
          onPageChange={handleChangePage}
          slotProps={{
            actions: {
              nextButton: { disabled: cursors?.next == null },
            },
          }}
        />
      </Paper>
      <Snackbar
        open={deleteError != null}
        autoHideDuration={6000}
        onClose={() => setDeleteError(undefined)}
      >
        <Alert onClose={() => setDeleteError(undefined)} severity="error">
          {deleteError}
        </Alert>
      </Snackbar>
    </>
  );
}
