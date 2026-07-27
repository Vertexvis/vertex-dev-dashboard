import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";
import React from "react";

interface Props {
  readonly cancelLabel?: string;
  readonly confirmLabel?: string;
  readonly confirming?: boolean;
  readonly message: React.ReactNode;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
  readonly open: boolean;
  readonly title: string;
}

export function ConfirmDialog({
  cancelLabel = "Cancel",
  confirmLabel = "Confirm",
  confirming = false,
  message,
  onClose,
  onConfirm,
  open,
  title,
}: Props): JSX.Element {
  return (
    <Dialog onClose={confirming ? undefined : onClose} open={open}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{message}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button disabled={confirming} onClick={onClose}>
          {cancelLabel}
        </Button>
        <Button
          color="error"
          disabled={confirming}
          onClick={onConfirm}
          startIcon={
            confirming ? (
              <CircularProgress color="inherit" size={16} />
            ) : undefined
          }
          variant="contained"
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
