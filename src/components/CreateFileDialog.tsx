import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Fade,
  LinearProgress,
  TextField,
} from "@material-ui/core";
import { CloudUploadOutlined } from "@material-ui/icons";
import { CreateFileRequestDataAttributes } from "@vertexvis/api-client-node";
import React from "react";

import { CreateFileRes } from "../pages/api/files";

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
  const [file, setFile] = React.useState<File | null | undefined>(null);
  const [suppliedId, setSuppliedId] = React.useState<string | undefined>();
  const [rootFileName, setRootFileName] = React.useState<string | undefined>();
  const [submitDisabled, setSubmitDisabled] = React.useState<boolean>(true);
  const [progress, setProgress] = React.useState<boolean>(false);

  async function handleUpload() {
    if (file) {
      setSubmitDisabled(true);
      setProgress(true);

      const attrs: CreateFileRequestDataAttributes = { name: file?.name };
      if (suppliedId) {
        attrs.suppliedId = suppliedId;
      }
      if (rootFileName) {
        attrs.rootFileName = rootFileName;
      }

      const fileRes = (await (
        await fetch("/api/files", {
          method: "POST",
          body: JSON.stringify(attrs),
        })
      ).json()) as unknown as CreateFileRes;

      const formData = new FormData();
      formData.append("file", file as Blob);

      await fetch(`/api/upload?f=${fileRes.id}`, {
        method: "POST",
        body: formData,
      });

      onFileCreated(fileRes.id);
      setFile(undefined);
      setSuppliedId(undefined);
      setRootFileName(undefined);
      setProgress(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth={true}>
      <DialogTitle>Add new File</DialogTitle>
      <DialogContent>
        <TextField
          margin="normal"
          id="suppliedId"
          label="Supplied ID"
          type="text"
          fullWidth
          onChange={(e) => setSuppliedId(e.target.value)}
        />
        <TextField
          margin="normal"
          id="rootFileName"
          label="Root File Name"
          type="text"
          fullWidth
          onChange={(e) => setRootFileName(e.target.value)}
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
                setFile(e.target?.files?.item(0));
              }}
            />
            <Button variant="outlined" component="span">
              Choose File
            </Button>
          </label>
          {!!file && <span style={{ marginLeft: "auto" }}>{file?.name}</span>}
        </Box>
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
        <Button onClick={onClose}>Cancel</Button>
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
