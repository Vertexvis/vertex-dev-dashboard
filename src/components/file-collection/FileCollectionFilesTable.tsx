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
  TableHead,
  TablePagination,
  TableRow,
  Typography,
} from "@mui/material";
import React from "react";
import useSWR from "swr";

import { isErrorRes } from "../../lib/api";
import { toLocaleString } from "../../lib/dates";
import { File, isCompleteFileStatus, toFilePage } from "../../lib/files";
import { useDebouncedFilter } from "../../lib/hooks/use-debounced-filter";
import { buildQuery, SwrProps, useCursorPagingState } from "../../lib/paging";
import { formatCursorPaginationLabel } from "../shared/cursor-pagination";
import { DataLoadError } from "../shared/DataLoadError";
import { FileFilterFields } from "../shared/FileFilterFields";
import { FileStatusChip } from "../shared/FileStatusChip";
import { DefaultPageSize, DefaultRowHeight } from "../shared/Layout";
import { ResourceLink } from "../shared/ResourceLink";
import { RowActionsMenu } from "../shared/RowActionsMenu";
import { SkeletonBody } from "../shared/SkeletonBody";
import { TableToolbar } from "../shared/TableToolbar";

interface Props {
  readonly activeFileId?: string;
  readonly apiPath: string;
  readonly collectionId?: string;
  readonly onAddFiles?: () => void;
  readonly onFileSelected: (file: File) => void;
  readonly onMembersChanged?: () => void;
}

interface UseCollectionFilesProps extends SwrProps {
  readonly apiPath: string;
  readonly fileId?: string;
}

const headCells = [
  { id: "name", label: "Name" },
  { id: "supplied-id", label: "Supplied ID" },
  { id: "status", label: "Status" },
  { id: "id", label: "ID" },
  { id: "created", label: "Created" },
  { id: "uploaded", label: "Uploaded" },
  { id: "actions", label: "Actions" },
] as const;

function useCollectionFiles({
  apiPath,
  cursor,
  fileId,
  name,
  pageSize,
  suppliedId,
}: UseCollectionFilesProps) {
  return useSWR(
    buildQuery(apiPath, {
      cursor,
      fileId,
      name,
      pageSize,
      suppliedId,
    })
  );
}

function isFileAvailable(file: File): boolean {
  return isCompleteFileStatus(file.status);
}

export default function FileCollectionFilesTable({
  activeFileId,
  apiPath,
  collectionId,
  onAddFiles,
  onFileSelected,
  onMembersChanged,
}: Props): JSX.Element {
  const pageSize = DefaultPageSize;
  const {
    currentPage,
    cursor,
    cursors,
    handlePageChange,
    resetPaging,
    setCursors,
  } = useCursorPagingState();
  const [downloadError, setDownloadError] = React.useState<string>();
  const [membershipError, setMembershipError] = React.useState<string>();
  const [removingMembers, setRemovingMembers] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [nameFilter, setNameFilter] = React.useState<string | undefined>();
  const [fileIdFilter, setFileIdFilter] = React.useState<string | undefined>();
  const [suppliedIdFilter, setSuppliedIdFilter] = React.useState<
    string | undefined
  >();

  const { data, error, mutate } = useCollectionFiles({
    apiPath,
    cursor,
    fileId: fileIdFilter,
    name: nameFilter,
    pageSize,
    suppliedId: suppliedIdFilter,
  });
  const loadError = error ?? (isErrorRes(data) ? data : undefined);
  const page = data && !isErrorRes(data) ? toFilePage(data) : undefined;
  // Set by the route when its filtered scan stopped at the page cap, so
  // matches beyond the scanned files may be missing.
  const truncated =
    data != null &&
    !isErrorRes(data) &&
    (data as { truncated?: boolean }).truncated === true;
  const pageLength = page ? page.items.length : 0;
  const paginationCursors = page?.cursors ?? cursors;
  const emptyRows =
    paginationCursors?.next == null && paginationCursors?.self == null
      ? 0
      : pageSize - pageLength;
  const manageMembers = collectionId != null;

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

  function handleChangePage(
    _: React.MouseEvent<HTMLButtonElement> | null,
    num: number
  ) {
    handlePageChange(num);
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

  function handleMemberSelection(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleRemoveMembers() {
    if (collectionId == null || selected.size === 0 || removingMembers) return;

    const ids = [...selected];
    const names = page?.items
      .filter((item) => selected.has(item.id))
      .map((item) => item.name ?? item.id)
      .join(", ");
    if (
      !window.confirm(
        `Remove ${
          names ?? ids.join(", ")
        } from this collection? This does not delete the source file.`
      )
    )
      return;

    setMembershipError(undefined);
    setRemovingMembers(true);
    try {
      const res = await fetch(apiPath, {
        body: JSON.stringify({ fileIds: ids }),
        headers: { "Content-Type": "application/json" },
        method: "DELETE",
      });
      const body = (await res.json()) as { message?: string };
      if (!res.ok) {
        setMembershipError(
          body.message ?? "Could not remove files from this collection."
        );
        return;
      }

      setSelected(new Set());
      await mutate();
      onMembersChanged?.();
    } catch {
      setMembershipError("Could not remove files from this collection.");
    } finally {
      setRemovingMembers(false);
    }
  }

  let tableRows: React.ReactNode;
  if (loadError) {
    tableRows = (
      <DataLoadError colSpan={headCells.length + (manageMembers ? 1 : 0)} />
    );
  } else if (!page) {
    tableRows = (
      <SkeletonBody
        includeCheckbox={false}
        numCellsPerRow={headCells.length}
        numRows={pageSize - pageLength}
        rowHeight={DefaultRowHeight}
      />
    );
  } else {
    tableRows = page.items.map((row) => {
      const isActive = activeFileId === row.id;
      const isAvailable = isFileAvailable(row);

      return (
        <TableRow
          hover
          tabIndex={-1}
          key={row.id}
          selected={isActive}
          onClick={() => onFileSelected(row)}
        >
          {manageMembers && (
            <TableCell
              padding="checkbox"
              onClick={(event) => {
                event.stopPropagation();
                handleMemberSelection(row.id);
              }}
            >
              <Checkbox
                checked={selected.has(row.id)}
                inputProps={{ "aria-label": `Select ${row.name ?? row.id}` }}
              />
            </TableCell>
          )}
          <TableCell component="th" scope="row">
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
            manageMembers ? (
              <Box sx={{ display: "flex", gap: 1 }}>
                <Button onClick={onAddFiles} size="small" variant="outlined">
                  Add completed files
                </Button>
                {selected.size > 0 && (
                  <Button
                    color="warning"
                    disabled={removingMembers}
                    onClick={handleRemoveMembers}
                    size="small"
                  >
                    {removingMembers ? "Removing" : "Remove from collection"}
                  </Button>
                )}
              </Box>
            ) : undefined
          }
          numSelected={selected.size}
          title="Files"
        />
        <FileFilterFields
          onFileIdChange={debouncedSetFileIdFilter}
          onNameChange={debouncedSetNameFilter}
          onSuppliedIdChange={debouncedSetSuppliedIdFilter}
        />
        {truncated && (
          <Typography
            color="text.secondary"
            component="p"
            sx={{ px: { sm: 2 }, pb: 1 }}
            variant="caption"
          >
            Showing matches from the first 1,000 files
          </Typography>
        )}
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                {manageMembers && <TableCell padding="checkbox" />}
                {headCells.map((headCell) => (
                  <TableCell key={headCell.id}>{headCell.label}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {tableRows}
              {emptyRows > 0 && (
                <TableRow style={{ height: DefaultRowHeight * emptyRows }}>
                  <TableCell
                    colSpan={headCells.length + (manageMembers ? 1 : 0)}
                  />
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
              page != null
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
      <Snackbar
        open={downloadError != null}
        autoHideDuration={6000}
        onClose={() => setDownloadError(undefined)}
      >
        <Alert onClose={() => setDownloadError(undefined)} severity="error">
          {downloadError}
        </Alert>
      </Snackbar>
      <Snackbar
        autoHideDuration={6000}
        onClose={() => setMembershipError(undefined)}
        open={membershipError != null}
      >
        <Alert onClose={() => setMembershipError(undefined)} severity="error">
          {membershipError}
        </Alert>
      </Snackbar>
    </>
  );
}
