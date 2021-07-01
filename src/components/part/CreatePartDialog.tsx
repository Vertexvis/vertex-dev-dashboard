import {
  Button,
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
}

function useFiles() {
  return useSWR(`/api/files?pageSize=25`, fetcher);
}

export default function CreatePartDialog({
  open,
  onClose,
  onPartCreated,
}: CreatePartDialogProps): JSX.Element {
  const [file, setFile] = React.useState<string | undefined>();
  const [suppliedId, setSuppliedId] = React.useState<string | undefined>();
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
