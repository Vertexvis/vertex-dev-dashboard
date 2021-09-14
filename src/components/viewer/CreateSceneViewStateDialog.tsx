import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";
import React from "react";

import {
  CreateViewStateReq,
  CreateViewStateRes,
} from "../../pages/api/scene-view-states";

interface CreateViewStateDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onViewStateCreated: (id: string) => void;
  readonly viewer: React.MutableRefObject<HTMLVertexViewerElement | null>;
}

export default function CreatePartDialog({
  open,
  onClose,
  onViewStateCreated,
  viewer,
}: CreateViewStateDialogProps): JSX.Element {
  const [name, setName] = React.useState<string | undefined>();
  const [submitDisabled, setSubmitDisabled] = React.useState(false);

  async function handleSubmit() {
    if (viewer.current) {
      setSubmitDisabled(true);

      const scene = await viewer.current.scene();
      const attrs: CreateViewStateReq = {
        viewId: scene.sceneViewId,
        name,
      };

      const res: CreateViewStateRes = await (
        await fetch("/api/scene-view-states", {
          method: "POST",
          body: JSON.stringify(attrs),
        })
      ).json();

      onViewStateCreated(res.id);
      setName(undefined);
      setSubmitDisabled(false);
    }
  }

  return (
    <Dialog fullWidth onClose={onClose} open={open}>
      <DialogTitle>Create View State</DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          label="Name"
          margin="normal"
          onChange={(e) => setName(e.target.value)}
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
