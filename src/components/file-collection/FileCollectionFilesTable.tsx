import {
  Alert,
  Chip,
  Paper,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
} from "@mui/material";
import React from "react";
import useSWR from "swr";

import { isErrorRes } from "../../lib/api";
import { toLocaleString } from "../../lib/dates";
import { File, toFilePage } from "../../lib/files";
import { buildQuery, SwrProps, useCursorPagingState } from "../../lib/paging";
import { DataLoadError } from "../shared/DataLoadError";
import { DefaultPageSize, DefaultRowHeight } from "../shared/Layout";
import { ResourceLink } from "../shared/ResourceLink";
import { RowActionsMenu } from "../shared/RowActionsMenu";
import { SkeletonBody } from "../shared/SkeletonBody";
import { TableToolbar } from "../shared/TableToolbar";

interface Props {
  readonly activeFileId?: string;
  readonly apiPath: string;
  readonly onFileSelected: (file: File) => void;
}

interface UseCollectionFilesProps extends SwrProps {
  readonly apiPath: string;
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
  pageSize,
}: UseCollectionFilesProps) {
  return useSWR(
    buildQuery(apiPath, {
      cursor,
      pageSize,
    })
  );
}

function isFileAvailable(file: File): boolean {
  return file.status?.toLowerCase() === "complete";
}

function statusLabel(status?: string): string {
  return status ?? "N/A";
}

function statusColor(
  status?: string
): "default" | "success" | "warning" | "error" {
  switch (status?.toLowerCase()) {
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

export default function FileCollectionFilesTable({
  activeFileId,
  apiPath,
  onFileSelected,
}: Props): JSX.Element {
  const pageSize = DefaultPageSize;
  const { currentPage, cursor, cursors, handlePageChange, setCursors } =
    useCursorPagingState();
  const [downloadError, setDownloadError] = React.useState<string>();

  const { data, error } = useCollectionFiles({
    apiPath,
    cursor,
    pageSize,
  });
  const loadError = error ?? (isErrorRes(data) ? data : undefined);
  const page = data && !isErrorRes(data) ? toFilePage(data) : undefined;
  const pageLength = page ? page.items.length : 0;
  const paginationCursors = page?.cursors ?? cursors;
  const emptyRows =
    paginationCursors?.next == null && paginationCursors?.self == null
      ? 0
      : pageSize - pageLength;

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

  let tableRows: React.ReactNode;
  if (loadError) {
    tableRows = <DataLoadError colSpan={headCells.length} />;
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
        <TableRow hover tabIndex={-1} key={row.id} selected={isActive}>
          <TableCell component="th" scope="row">
            <ResourceLink onOpen={() => onFileSelected(row)}>
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
        <TableToolbar numSelected={0} title="Files" />
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                {headCells.map((headCell) => (
                  <TableCell key={headCell.id}>{headCell.label}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {tableRows}
              {emptyRows > 0 && (
                <TableRow style={{ height: DefaultRowHeight * emptyRows }}>
                  <TableCell colSpan={headCells.length} />
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
