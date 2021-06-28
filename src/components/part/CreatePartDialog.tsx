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
import { FileMetadataData } from "@vertexvis/api-client-node";
import React from "react";

import { GetRes } from "../../lib/api";
import { toFilePage } from "../../lib/files";
import { File } from "../../lib/files";
import { CreatePartBody, CreatePartRes } from "../../pages/api/parts";

interface CreatePartDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onPartCreated: (queuedTranslationId: string) => void;
}

export default function CreatePartDialog({
  open,
  onClose,
  onPartCreated,
}: CreatePartDialogProps): JSX.Element {
  const [file, setFile] = React.useState<string | undefined>();
  const [files, setFiles] = React.useState<File[] | undefined>();
  const [suppliedId, setSuppliedId] = React.useState<string | undefined>();
  const [suppliedRevisionId, setSuppliedRevisionId] = React.useState<
    string | undefined
  >();
  const [submitDisabled, setSubmitDisabled] = React.useState<boolean>(true);

  React.useEffect(() => {
    const fetchData = async () => {
      const result = await fetch(`/api/files?pageSize=25`).then((r) =>
        r.json()
      );
      const res = (await result) as GetRes<FileMetadataData>;

      setFiles(toFilePage(res).items);
    };

    fetchData();
  }, []);

  function checkSubmit() {
    if (file && suppliedId && suppliedRevisionId) {
      setSubmitDisabled(false);
    } else {
      setSubmitDisabled(true);
    }
  }

  async function handleSubmit() {
    if (file && suppliedId && suppliedRevisionId) {
      setSubmitDisabled(true);

      const attrs: CreatePartBody = {
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

      onPartCreated(partRes.queuedTranslationId);
      setFile(undefined);
      setSuppliedId(undefined);
      setSuppliedRevisionId(undefined);
    }
  }

  return (
    <Dialog fullWidth onClose={onClose} open={open}>
      <DialogTitle>Create Part</DialogTitle>
      <DialogContent>
        <FormControl component="fieldset" sx={{ height: 300, width: "100%" }}>
          <FormLabel component="legend">Recent Files</FormLabel>
          <RadioGroup
            aria-label="files"
            name="radio-buttons-group"
            onChange={(e) => {
              setFile(e.target.value);
              checkSubmit();
            }}
          >
            {files &&
              files.map((f) => {
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
