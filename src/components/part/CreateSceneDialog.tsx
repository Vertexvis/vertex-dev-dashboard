import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from "@material-ui/core";
import React from "react";

import { CreateSceneReq, CreateSceneRes } from "../../pages/api/scenes";

interface CreateSceneDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onSceneQueued: (queuedSceneItemId: string) => void;
  readonly targetRevisionId?: string;
}

export default function CreateSceneDialog({
  open,
  onClose,
  targetRevisionId,
  onSceneQueued,
}: CreateSceneDialogProps): JSX.Element {
  const [suppliedId, setSuppliedId] = React.useState<string | undefined>();
  const [name, setName] = React.useState<string | undefined>();
  const [submitDisabled, setSubmitDisabled] = React.useState(false);

  async function handleSubmit() {
    if (targetRevisionId) {
      setSubmitDisabled(true);

      const attrs: CreateSceneReq = {
        suppliedId,
        name,
        revisionId: targetRevisionId,
      };

      const sceneRes: CreateSceneRes = await (
        await fetch("/api/scenes", {
          method: "POST",
          body: JSON.stringify(attrs),
        })
      ).json();

      onSceneQueued(sceneRes.id);
      setSuppliedId(undefined);
      setName(undefined);
    }
  }

  return (
    <Dialog fullWidth onClose={onClose} open={open}>
      <DialogTitle>Create Scene From Revision</DialogTitle>
      <DialogContent>
        <Typography>
          <strong>Revision:</strong> {targetRevisionId}
        </Typography>

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
