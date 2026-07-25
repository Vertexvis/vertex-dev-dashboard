import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import debounce from "lodash.debounce";
import React from "react";
import useSWR from "swr";

import { isErrorRes } from "../../lib/api";
import { File, isCompleteFileStatus, toFilePage } from "../../lib/files";
import { buildQuery, Paged } from "../../lib/paging";
import { FileStatusChip } from "../shared/FileStatusChip";
import { DefaultRowHeight } from "../shared/Layout";
import { SkeletonBody } from "../shared/SkeletonBody";

interface Props {
  readonly collectionId: string;
  readonly onClose: () => void;
  readonly onMembersAdded: () => void;
  readonly open: boolean;
}

const UuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const headCells = [
  { id: "name", label: "Name" },
  { id: "supplied-id", label: "Supplied ID" },
  { id: "status", label: "Status" },
  { id: "id", label: "ID" },
] as const;

function mergeMatches(
  byName?: Paged<File>,
  bySuppliedId?: Paged<File>
): File[] | undefined {
  if (byName == null) return undefined;

  const merged = new Map(byName.items.map((file) => [file.id, file]));
  bySuppliedId?.items.forEach((file) => {
    if (!merged.has(file.id)) merged.set(file.id, file);
  });
  return [...merged.values()];
}

export function AddFilesToCollectionDialog({
  collectionId,
  onClose,
  onMembersAdded,
  open,
}: Props): JSX.Element {
  const [search, setSearch] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [submitError, setSubmitError] = React.useState<string>();
  const [submitting, setSubmitting] = React.useState(false);
  const debouncedSetQuery = React.useMemo(
    () => debounce((value: string) => setQuery(value.trim()), 300),
    []
  );
  const isIdSearch = UuidPattern.test(query);
  const { data, error } = useSWR(
    open
      ? buildQuery("/api/files", {
          fileId: isIdSearch ? query.toLowerCase() : undefined,
          name: isIdSearch || query === "" ? undefined : query,
          pageSize: 10,
        })
      : null
  );
  const suppliedIdQueryKey =
    open && !isIdSearch && query !== ""
      ? buildQuery("/api/files", { pageSize: 10, suppliedId: query })
      : null;
  const { data: suppliedIdData, error: suppliedIdError } =
    useSWR(suppliedIdQueryKey);
  const loadError =
    error ??
    suppliedIdError ??
    (isErrorRes(data) ? data : undefined) ??
    (isErrorRes(suppliedIdData) ? suppliedIdData : undefined);
  const files = mergeMatches(
    data != null && !isErrorRes(data) ? toFilePage(data) : undefined,
    suppliedIdData != null && !isErrorRes(suppliedIdData)
      ? toFilePage(suppliedIdData)
      : undefined
  );
  const suppliedIdPending =
    suppliedIdQueryKey != null &&
    suppliedIdData == null &&
    suppliedIdError == null;

  React.useEffect(() => {
    if (!open) {
      debouncedSetQuery.cancel();
      setSearch("");
      setQuery("");
      setSelected(new Set());
      setSubmitError(undefined);
    }
  }, [debouncedSetQuery, open]);

  function toggle(file: File) {
    if (!isCompleteFileStatus(file.status)) return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(file.id)) next.delete(file.id);
      else next.add(file.id);
      return next;
    });
  }

  async function handleAdd() {
    if (selected.size === 0 || submitting) return;

    setSubmitError(undefined);
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/file-collections/${encodeURIComponent(collectionId)}/files`,
        {
          body: JSON.stringify({ fileIds: [...selected] }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        }
      );
      const body = (await res.json()) as { message?: string };
      if (!res.ok) {
        setSubmitError(
          body.message ?? "Could not add files to this collection."
        );
        return;
      }

      onMembersAdded();
      onClose();
    } catch {
      setSubmitError("Could not add files to this collection.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog fullWidth maxWidth="md" onClose={onClose} open={open}>
      <DialogTitle>Add completed files</DialogTitle>
      <DialogContent>
        <Typography color="text.secondary" sx={{ mb: 2 }} variant="body2">
          Only complete files can be added. Adding a file does not move or
          delete its source.
        </Typography>
        <TextField
          autoFocus
          fullWidth
          helperText="Matches names and supplied IDs. Paste a file ID (UUID) to look it up directly."
          label="Search files"
          onChange={(event) => {
            setSearch(event.target.value);
            debouncedSetQuery(event.target.value);
          }}
          placeholder="Name, supplied ID, or file ID"
          value={search}
        />
        {submitError != null && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {submitError}
          </Alert>
        )}
        {loadError != null ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            Could not load files.
          </Alert>
        ) : (
          <TableContainer sx={{ mt: 2 }}>
            <Table aria-label="Eligible files" size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" />
                  {headCells.map((headCell) => (
                    <TableCell key={headCell.id}>{headCell.label}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {files == null || (files.length === 0 && suppliedIdPending) ? (
                  <SkeletonBody
                    includeCheckbox={true}
                    numCellsPerRow={headCells.length + 1}
                    numRows={3}
                    rowHeight={DefaultRowHeight}
                  />
                ) : (
                  <>
                    {files.map((file) => {
                      const eligible = isCompleteFileStatus(file.status);
                      return (
                        <TableRow
                          hover
                          key={file.id}
                          onClick={() => toggle(file)}
                          selected={selected.has(file.id)}
                        >
                          <TableCell
                            padding="checkbox"
                            onClick={(event) => {
                              event.stopPropagation();
                              toggle(file);
                            }}
                          >
                            <Checkbox
                              checked={selected.has(file.id)}
                              disabled={!eligible}
                              inputProps={{
                                "aria-label": `Select ${file.name ?? file.id}`,
                              }}
                            />
                          </TableCell>
                          <TableCell component="th" scope="row">
                            {file.name ?? file.id}
                          </TableCell>
                          <TableCell>{file.suppliedId}</TableCell>
                          <TableCell>
                            <FileStatusChip status={file.status} />
                          </TableCell>
                          <TableCell
                            sx={{
                              fontFamily: "monospace",
                              fontSize: "0.75rem",
                              letterSpacing: "-0.02em",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {file.id}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {files.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={headCells.length + 1}>
                          No matching files.
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          disabled={selected.size === 0 || submitting}
          onClick={handleAdd}
          variant="contained"
        >
          {submitting
            ? "Adding"
            : selected.size > 0
            ? `Add ${selected.size} ${selected.size === 1 ? "file" : "files"}`
            : "Add files"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
