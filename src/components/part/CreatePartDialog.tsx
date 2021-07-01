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
} from "@material-ui/core";
import React from "react";
import useSWR from "swr";

import { fetcher } from "../../lib/api";
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
  return useSWR(`/api/files?pageSize=25`, fetcher);
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
  const [submitDisabled, setSubmitDisabled] = React.useState(true);
  const { data } = useFiles();
  const files = data ? toFilePage(data) : undefined;

  function checkSubmit() {
    setSubmitDisabled(!file || !suppliedId || !suppliedRevisionId);
  }

  async function handleSubmit() {
    if (!file || !suppliedId || !suppliedRevisionId) return;

    setSubmitDisabled(true);

    const attrs: CreatePartReq = {
      fileId: file,
      suppliedId,
      suppliedRevisionId,
      indexMetadata,
    };

    const partRes = (await (
      await fetch("/api/parts", {
        method: "POST",
        body: JSON.stringify(attrs),
      })
    ).json()) as unknown as CreatePartRes;

    onPartCreated(partRes.id);
    setFile(undefined);
    setSuppliedId(undefined);
    setSuppliedRevisionId(undefined);
  }

  return (
    <Dialog fullWidth onClose={onClose} open={open}>
      <DialogTitle>Create Part</DialogTitle>
      <DialogContent>
        {targetFileId && <Typography><strong>File:</strong> {targetFileName}</Typography>}
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
              aria-label="files"
              name="radio-buttons-group"
              onChange={(e) => {
                setFile(e.target.value);
                checkSubmit();
              }}
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
          onChange={(e) => {
            setSuppliedId(e.target.value);
            checkSubmit();
          }}
          size="small"
          type="text"
        />
        <TextField
          fullWidth
          required
          label="Supplied Revision ID"
          margin="normal"
          onChange={(e) => {
            setSuppliedRevisionId(e.target.value);
            checkSubmit();
          }}
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
