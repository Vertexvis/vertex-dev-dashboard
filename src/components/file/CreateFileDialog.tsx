import { CloudUploadOutlined } from "@mui/icons-material";
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Fade,
  FormControlLabel,
  LinearProgress,
  TextField,
} from "@mui/material";
import { CreateFileRequestDataAttributes } from "@vertexvis/api-client-node";
import { useRouter } from "next/router";
import React from "react";

import { CreateFileRes } from "../../pages/api/files";

interface CreateFileDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onFileCreated: (fileId: string) => void;
}

export default function CreateFileDialog({
  open,
  onClose,
  onFileCreated,
}: CreateFileDialogProps): JSX.Element {
  const [file, setFile] = React.useState<File | undefined>();
  const [suppliedId, setSuppliedId] = React.useState<string | undefined>();
  const [rootFileName, setRootFileName] = React.useState<string | undefined>();
  const [submitDisabled, setSubmitDisabled] = React.useState(true);
  const [createPart, setCreatePart] = React.useState(true);
  const [progress, setProgress] = React.useState<boolean>(false);
  const router = useRouter();

  async function handleUpload() {
    if (file == null) return;

    setSubmitDisabled(true);
    setProgress(true);

    const attrs: CreateFileRequestDataAttributes = { name: file?.name };
    if (suppliedId) {
      attrs.suppliedId = suppliedId;
    }
    if (rootFileName) {
      attrs.rootFileName = rootFileName;
    }

    const fileRes: CreateFileRes = await (
      await fetch("/api/files", {
        method: "POST",
        body: JSON.stringify(attrs),
      })
    ).json();

    const formData = new FormData();
    formData.append("file", file);

    await fetch(`/api/upload?f=${fileRes.id}`, {
      method: "POST",
      body: formData,
    });

    onFileCreated(fileRes.id);

    if (createPart) {
      router.push(`/parts?create=${fileRes.id}&n=${file?.name}`);
    }

    setFile(undefined);
    setSuppliedId(undefined);
    setRootFileName(undefined);
    setProgress(false);
  }

  return (
    <Dialog fullWidth onClose={onClose} open={open}>
      <DialogTitle>Add new File</DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          label="Supplied ID"
          margin="normal"
          onChange={(e) => setSuppliedId(e.target.value)}
          size="small"
          type="text"
        />
        <TextField
          fullWidth
          label="Root File Name"
          margin="normal"
          onChange={(e) => setRootFileName(e.target.value)}
          size="small"
          type="text"
        />

        <Box sx={{ py: 2, display: "flex" }}>
          <label htmlFor="btn-upload">
            <input
              id="btn-upload"
              name="btn-upload"
              style={{ display: "none" }}
              type="file"
              onChange={(e) => {
                setSubmitDisabled(false);
                setFile(e.target?.files?.item(0) ?? undefined);
              }}
            />
            <Button variant="outlined" component="span">
              Choose File
            </Button>
          </label>
          {!!file && <span style={{ marginLeft: "auto" }}>{file?.name}</span>}
        </Box>
        <FormControlLabel
          control={
            <Checkbox
              defaultChecked
              onChange={(e) => setCreatePart(e.target.checked)}
            />
          }
          label="Create Part After Upload"
        />
      </DialogContent>
      <Fade
        in={progress}
        style={{
          transitionDelay: progress ? "300ms" : "0ms",
        }}
        unmountOnExit
      >
        <LinearProgress />
      </Fade>
      <DialogActions>
        <Button onClick={onClose} sx={{ mr: 2 }}>
          Cancel
        </Button>
        <Button
          disabled={submitDisabled}
          startIcon={<CloudUploadOutlined />}
          onClick={handleUpload}
          color="primary"
          variant="contained"
        >
          Upload
        </Button>
      </DialogActions>
    </Dialog>
  );
}
