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

import { MergeSceneReq, MergeSceneRes } from "../../pages/api/merged-scenes";
import { CreateSceneReq, CreateSceneRes } from "../../pages/api/scenes";

interface CreateSceneDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onSceneQueued: (queuedSceneItemIds: string[]) => void;
  readonly targetRevisionId?: string;
  readonly scenesToMerge?: string[];
}

export default function CreateSceneDialog({
  open,
  onClose,
  targetRevisionId,
  onSceneQueued,
  scenesToMerge,
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

      onSceneQueued([sceneRes.id]);
      setSuppliedId(undefined);
      setName(undefined);
    }

    if (scenesToMerge) {
      setSubmitDisabled(true);

      const attrs: MergeSceneReq = {
        suppliedId,
        name,
        sceneIds: scenesToMerge,
      };

      const sceneRes: MergeSceneRes = await (
        await fetch("/api/merged-scenes", {
          method: "POST",
          body: JSON.stringify(attrs),
        })
      ).json();

      onSceneQueued(sceneRes.queuedItemIds);
      setSuppliedId(undefined);
      setName(undefined);
    }
  }

  return (
    <Dialog fullWidth onClose={onClose} open={open}>
      <DialogTitle>Create Scene</DialogTitle>
      <DialogContent>
        {targetRevisionId && (
          <Typography>
            <strong>Revision:</strong> {targetRevisionId}
          </Typography>
        )}

        {scenesToMerge && (
          <Typography>
            <span>Merge Scenes:</span>

            <ul>
              {scenesToMerge.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </Typography>
        )}

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
