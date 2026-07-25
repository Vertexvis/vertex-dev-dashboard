import { Add } from "@mui/icons-material";
import {
  Alert,
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
} from "@mui/material";
import React from "react";
import useSWR from "swr";

import { isErrorRes } from "../../lib/api";
import { toLocaleString } from "../../lib/dates";
import { File, isCompleteFileStatus, toFilePage } from "../../lib/files";
import { useDebouncedFilter } from "../../lib/hooks/use-debounced-filter";
import { buildQuery, SwrProps, useCursorPagingState } from "../../lib/paging";
import { SortState, toggleSort, toSortParam } from "../../lib/sorting";
import { confirmResourceDeletion } from "../shared/confirm-delete";
import {
  CreatedAtDateRange,
  CreatedAtDateRangeFilter,
} from "../shared/CreatedAtDateRangeFilter";
import { formatCursorPaginationLabel } from "../shared/cursor-pagination";
import { DataLoadError } from "../shared/DataLoadError";
import { FileFilterFields } from "../shared/FileFilterFields";
import { FileStatusChip } from "../shared/FileStatusChip";
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

interface Props {
  readonly activeFileId?: string;
  readonly onFileSelected: (file: File) => void;
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
  const [nameFilter, setNameFilter] = React.useState<string | undefined>();
  const [fileIdFilter, setFileIdFilter] = React.useState<string | undefined>();
  const [suppliedIdFilter, setSuppliedIdFilter] = React.useState<
    string | undefined
  >();
  const [createdAtFilters, setCreatedAtFilters] =
    React.useState<CreatedAtDateRange>({});
  const [showToast, setShowToast] = React.useState(false);
  const [downloadError, setDownloadError] = React.useState<string>();

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

  function handleCreatedAtChange(filters: CreatedAtDateRange) {
    resetPaging();
    setCreatedAtFilters(filters);
  }

  async function handleDelete() {
    if (selected.size === 0 || !confirmResourceDeletion(selected.size, "file"))
      return;

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
            <FileStatusChip status={row.status} />
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
        <FileFilterFields
          onFileIdChange={debouncedSetFileIdFilter}
          onNameChange={debouncedSetNameFilter}
          onSuppliedIdChange={debouncedSetSuppliedIdFilter}
        />
        <CreatedAtDateRangeFilter onChange={handleCreatedAtChange} />
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
