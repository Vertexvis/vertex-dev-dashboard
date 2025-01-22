import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from "@mui/material";
import React from "react";
import useSWR from "swr";

import { toFilePage } from "../../lib/files";
import { CreatePartReq, CreatePartRes } from "../../pages/api/parts";

interface CreatePartDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onPartCreated: (queuedTranslationId: string) => void;
  readonly targetFileId?: string;
  readonly targetFileName?: string;
}

function useFiles() {
  return useSWR(`/api/files?pageSize=25`);
}

export default function CreatePartDialog({
  open,
  onClose,
  onPartCreated,
  targetFileId,
  targetFileName,
}: CreatePartDialogProps): JSX.Element {
  const [file, setFile] = React.useState(targetFileId);
  const [suppliedId, setSuppliedId] = React.useState<string | undefined>();
  const [indexMetadata, setIndexMetadata] = React.useState(true);
  const [suppliedRevisionId, setSuppliedRevisionId] = React.useState<
    string | undefined
  >();
  const [suppliedIterationId, setSuppliedIterationId] = React.useState<
    string | undefined
  >();
  const [submitDisabled, setSubmitDisabled] = React.useState(true);
  const { data } = useFiles();
  const files = data ? toFilePage(data) : undefined;

  React.useEffect(() => {
    setSubmitDisabled(!file || !suppliedId || !suppliedRevisionId);
  }, [file, suppliedId, suppliedRevisionId]);

  async function handleSubmit() {
    if (!file || !suppliedId || !suppliedRevisionId) {
      return;
    }

    setSubmitDisabled(true);

    const attrs: CreatePartReq = {
      fileId: file,
      suppliedId,
      suppliedRevisionId,
      suppliedIterationId,
      indexMetadata,
    };

    const partRes: CreatePartRes = await (
      await fetch("/api/parts", {
        method: "POST",
        body: JSON.stringify(attrs),
      })
    ).json();

    onPartCreated(partRes.id);
    setFile(undefined);
    setSuppliedId(undefined);
    setSuppliedRevisionId(undefined);
    setSuppliedIterationId(undefined);
  }

  return (
    <Dialog fullWidth onClose={onClose} open={open}>
      <DialogTitle>Create Part</DialogTitle>
      <DialogContent>
        {targetFileId && (
          <Typography>
            <strong>File:</strong> {targetFileName}
          </Typography>
        )}
        {!targetFileId && (
          <FormControl
            component="fieldset"
            sx={{ height: 300, width: "100%", overflow: "auto" }}
          >
            <FormLabel htmlFor="files-list" component="legend">
              Recent Files
            </FormLabel>
            <RadioGroup
              id="files-list"
              name="radio-buttons-group"
              onChange={(e) => setFile(e.target.value)}
            >
              {files &&
                files?.items.map((f) => {
                  return (
                    <FormControlLabel
                      key={f.id}
                      value={f.id}
                      control={<Radio />}
                      label={f.name}
                    />
                  );
                })}
            </RadioGroup>
          </FormControl>
        )}

        <TextField
          fullWidth
          required
          label="Supplied ID"
          margin="normal"
          onChange={(e) => setSuppliedId(e.target.value)}
          size="small"
          type="text"
        />
        <TextField
          fullWidth
          required
          label="Supplied Revision ID"
          margin="normal"
          onChange={(e) => setSuppliedRevisionId(e.target.value)}
          size="small"
          type="text"
        />
        <TextField
          fullWidth
          label="Supplied Iteration ID (optional)"
          margin="normal"
          onChange={(e) => setSuppliedIterationId(e.target.value)}
          size="small"
          type="text"
        />
        <FormControlLabel
          control={
            <Checkbox
              defaultChecked
              onChange={(e) => setIndexMetadata(e.target.checked)}
            />
          }
          label="Index Metadata"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          disabled={submitDisabled}
          onClick={handleSubmit}
          color="primary"
          variant="contained"
        >
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}
