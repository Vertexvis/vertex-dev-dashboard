import { Close } from "@mui/icons-material";
import { Alert, Button, IconButton, Snackbar } from "@mui/material";
import NextLink from "next/link";
import React from "react";

interface ViewTranslationsToastProps {
  readonly open: boolean;
  readonly message?: string;
  readonly onClose: () => void;
}

/**
 * Success toast shown after a translation is initiated. Carries a "View
 * translations" link plus an explicit Close button, and dwells longer than the
 * error toasts so users have time to reach the action.
 */
export function ViewTranslationsToast({
  open,
  message,
  onClose,
}: ViewTranslationsToastProps): JSX.Element {
  return (
    <Snackbar autoHideDuration={12000} onClose={onClose} open={open}>
      <Alert
        action={
          <>
            <Button
              color="inherit"
              component={NextLink}
              href="/translations"
              size="small"
            >
              View translations
            </Button>
            <IconButton
              aria-label="Close"
              color="inherit"
              onClick={onClose}
              size="small"
            >
              <Close fontSize="small" />
            </IconButton>
          </>
        }
        onClose={onClose}
        severity="success"
      >
        {message}
      </Alert>
    </Snackbar>
  );
}
