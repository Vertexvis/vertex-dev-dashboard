import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  Select,
  TextField,
} from "@material-ui/core";
import { Environment } from "@vertexvis/viewer";
import React from "react";

import { AccountCredentials } from "../lib/config";

interface Props {
  readonly credentials: Partial<AccountCredentials>;
  readonly open: boolean;
  readonly onClose: VoidFunction;
  readonly onConfirm: (credentials: AccountCredentials) => void;
}

interface Value {
  value: string;
}

export function AccountDialog({
  credentials,
  open,
  onClose,
  onConfirm,
}: Props): JSX.Element {
  const [inputCreds, setInputCreds] =
    React.useState<Partial<AccountCredentials>>(credentials);
  const invalidClientId =
    inputCreds.clientId == null || inputCreds.clientId.length > 64;
  const invalidClientSecret =
    inputCreds.clientSecret == null || inputCreds.clientSecret.length > 48;
  const invalidVertexEnv = inputCreds.vertexEnv == null;

  function handleClientIdChange(e: React.ChangeEvent<Value>): void {
    setInputCreds({ ...inputCreds, clientId: e.target.value });
  }

  function handleClientSecretChange(e: React.ChangeEvent<Value>): void {
    setInputCreds({ ...inputCreds, clientSecret: e.target.value });
  }

  function handleVertexEnvChange(e: React.ChangeEvent<Value>): void {
    setInputCreds({ ...inputCreds, vertexEnv: e.target.value as Environment });
  }

  function handleClick(): void {
    if (!invalidClientId && !invalidClientSecret && !invalidVertexEnv) {
      onConfirm(inputCreds as AccountCredentials);
    }
  }

  return (
    <Dialog fullWidth maxWidth="md" onClose={onClose} open={open}>
      <DialogTitle id="open-scene-title">Open Scene</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Enter the client ID and stream key of your scene.
        </DialogContentText>
        <TextField
          autoFocus={true}
          error={invalidClientId}
          fullWidth
          helperText={invalidClientId ? "Valid client ID required." : undefined}
          label="Client ID"
          margin="normal"
          onChange={handleClientIdChange}
          size="small"
          value={inputCreds.clientId}
        />
        <TextField
          error={invalidClientSecret}
          fullWidth
          helperText={
            invalidClientSecret ? "Valid client secret required." : undefined
          }
          label="Client secret"
          margin="normal"
          onChange={handleClientSecretChange}
          size="small"
          type="password"
          value={inputCreds.clientSecret}
        />
        <Select
          onChange={handleVertexEnvChange}
          size="small"
          value={inputCreds.vertexEnv ?? "platprod"}
        >
          <MenuItem value="platdev">platdev</MenuItem>
          <MenuItem value="platstaging">platstaging</MenuItem>
          <MenuItem value="platprod">platprod</MenuItem>
        </Select>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleClick}>Open</Button>
      </DialogActions>
    </Dialog>
  );
}
