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
import { Cursors } from "@vertexvis/api-client-node";
import debounce from "lodash.debounce";
import React from "react";
import useSWR from "swr";

import { toLocaleString } from "../../lib/dates";
import { File, toFilePage } from "../../lib/files";
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
  { id: "download", label: "Download" },
];

interface Props {
  readonly activeFileId?: string;
  readonly onFileSelected: (file: File) => void;
}

export default function FilesTable({
  activeFileId,
  onFileSelected,
}: Props): JSX.Element {
  const pageSize = DefaultPageSize;
  const [curPage, setCurPage] = React.useState(0);
  const [cursor, setCursor] = React.useState<string | undefined>();
  const [cursors, setCursors] = React.useState<Cursors | undefined>();
  const [prev, setPrev] = React.useState<Record<number, string | undefined>>(
    {}
  );
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [showDialog, setShowDialog] = React.useState(false);
  const [name, setNameFilter] = React.useState<string | undefined>();
  const [fileId, setFileIdFilter] = React.useState<string | undefined>();
  const [suppliedId, setSuppliedIdFilter] = React.useState<
    string | undefined
  >();
  const [createdAtFrom, setCreatedAtFrom] = React.useState<string | undefined>();
  const [createdAtTo, setCreatedAtTo] = React.useState<string | undefined>();
  const [showToast, setShowToast] = React.useState(false);
  const [downloadError, setDownloadError] = React.useState<string>();

  const params = new URLSearchParams({ pageSize: pageSize.toString() });
  if (cursor != null) params.set("cursor", cursor);
  if (name != null) params.set("name", name);
  if (fileId != null) params.set("fileId", fileId);
  if (suppliedId != null) params.set("suppliedId", suppliedId);
  if (createdAtFrom != null) params.set("createdAtFrom", createdAtFrom);
  if (createdAtTo != null) params.set("createdAtTo", createdAtTo);

  const { data, error, mutate } = useSWR(`/api/files?${params.toString()}`);
  const page = data ? toFilePage(data) : undefined;
  const pageLength = page ? page.items.length : 0;
  const emptyRows =
    cursors?.next == null && cursors?.self == null ? 0 : pageSize - pageLength;

  const resetPaging = React.useCallback(() => {
    setCurPage(0);
    setCursor(undefined);
    setPrev({});
  }, []);

  const debouncedSetNameFilter = React.useMemo(
    () =>
      debounce((value: string) => {
        resetPaging();
        setNameFilter(value === "" ? undefined : value);
      }, 300),
    [resetPaging]
  );
  const debouncedSetFileIdFilter = React.useMemo(
    () =>
      debounce((value: string) => {
        resetPaging();
        setFileIdFilter(value === "" ? undefined : value);
      }, 300),
    [resetPaging]
  );
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
              id="createdAtFrom"
              label="Created From"
              type="date"
              InputLabelProps={{ shrink: true }}
              onChange={(e) => {
                resetPaging();
                setCreatedAtFrom(
                  e.target.value ? `${e.target.value}T00:00:00.000Z` : undefined
                );
              }}
              sx={{ mt: 0, width: "12rem" }}
            />
            <TextField
              variant="standard"
              size="small"
              margin="normal"
              id="createdAtTo"
              label="Created To"
              type="date"
              InputLabelProps={{ shrink: true }}
              onChange={(e) => {
                resetPaging();
                setCreatedAtTo(
                  e.target.value ? `${e.target.value}T23:59:59.999Z` : undefined
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
              rowCount={pageLength}
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
