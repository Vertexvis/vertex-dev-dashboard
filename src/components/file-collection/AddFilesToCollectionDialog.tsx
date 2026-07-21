import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  TextField,
  Typography,
} from "@mui/material";
import React from "react";
import useSWR from "swr";

import { isErrorRes } from "../../lib/api";
import { File, isCompleteFileStatus, toFilePage } from "../../lib/files";
import { buildQuery } from "../../lib/paging";

interface Props {
  readonly collectionId: string;
  readonly onClose: () => void;
  readonly onMembersAdded: () => void;
  readonly open: boolean;
}

export function AddFilesToCollectionDialog({
  collectionId,
  onClose,
  onMembersAdded,
  open,
}: Props): JSX.Element {
  const [name, setName] = React.useState("");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [submitError, setSubmitError] = React.useState<string>();
  const [submitting, setSubmitting] = React.useState(false);
  const { data, error } = useSWR(
    open
      ? buildQuery("/api/files", {
          name: name === "" ? undefined : name,
          pageSize: 10,
        })
      : null
  );
  const page = data != null && !isErrorRes(data) ? toFilePage(data) : undefined;

  React.useEffect(() => {
    if (!open) {
      setName("");
      setSelected(new Set());
      setSubmitError(undefined);
    }
  }, [open]);

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
    <Dialog fullWidth maxWidth="sm" onClose={onClose} open={open}>
      <DialogTitle>Add completed files</DialogTitle>
      <DialogContent>
        <Typography color="text.secondary" sx={{ mb: 2 }} variant="body2">
          Only complete files can be added. Adding a file does not move or
          delete its source.
        </Typography>
        <TextField
          autoFocus
          fullWidth
          label="Search files"
          onChange={(event) => setName(event.target.value)}
          placeholder="Filter by file name"
          value={name}
        />
        {submitError != null && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {submitError}
          </Alert>
        )}
        {error != null || isErrorRes(data) ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            Could not load files.
          </Alert>
        ) : (
          <List aria-label="Eligible files" dense>
            {page?.items.map((file) => {
              const eligible = isCompleteFileStatus(file.status);
              return (
                <ListItem disablePadding key={file.id}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={selected.has(file.id)}
                        disabled={!eligible}
                        onChange={() => toggle(file)}
                      />
                    }
                    label={`${file.name ?? file.id} (${
                      file.status ?? "unknown"
                    })`}
                  />
                </ListItem>
              );
            })}
            {page != null && page.items.length === 0 && (
              <ListItem>
                <ListItemText primary="No matching files." />
              </ListItem>
            )}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          disabled={selected.size === 0 || submitting}
          onClick={handleAdd}
          variant="contained"
        >
          {submitting ? "Adding" : "Add files"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
