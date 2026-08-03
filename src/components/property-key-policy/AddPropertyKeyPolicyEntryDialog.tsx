import { Add, Delete } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React from 'react';

import { isErrorRes } from '../../lib/api';
import { AddPropertyKeyPolicyKeysReq } from '../../lib/property-key-policies';

interface Props {
  readonly onAdded: () => void;
  readonly onClose: () => void;
  readonly open: boolean;
  readonly policyId: string;
}

const CaseSensitivityHelperText =
  'Metadata property keys are case-sensitive and are saved exactly as typed.';

export default function AddPropertyKeyPolicyEntryDialog({
  onAdded,
  onClose,
  open,
  policyId,
}: Props): JSX.Element {
  const [keys, setKeys] = React.useState<string[]>(['']);
  const [submitting, setSubmitting] = React.useState(false);
  const [validationError, setValidationError] = React.useState<string>();
  const [apiError, setApiError] = React.useState<string>();

  function reset(): void {
    setKeys(['']);
    setSubmitting(false);
    setValidationError(undefined);
    setApiError(undefined);
  }

  function handleClose(): void {
    if (submitting) return;
    reset();
    onClose();
  }

  function handleKeyChange(index: number, value: string): void {
    setKeys((current) => current.map((k, i) => (i === index ? value : k)));
  }

  function handleAddKey(): void {
    setKeys((current) => [...current, '']);
  }

  function handleRemoveKey(index: number): void {
    setKeys((current) =>
      current.length === 1 ? [''] : current.filter((_, i) => i !== index)
    );
  }

  // Keys are NOT trimmed here to preserve case exactly. We only skip entries
  // that are empty or whitespace-only when deciding what to submit.
  const nonEmptyKeys = keys.filter((k) => k.trim() !== '');
  const submitDisabled = submitting || nonEmptyKeys.length === 0;

  async function handleSubmit(): Promise<void> {
    setValidationError(undefined);
    setApiError(undefined);

    if (nonEmptyKeys.length === 0) {
      setValidationError('Add at least one property key.');
      return;
    }

    const body: AddPropertyKeyPolicyKeysReq = { keys: nonEmptyKeys };

    setSubmitting(true);

    const res = await fetch(
      `/api/property-key-policies/${encodeURIComponent(policyId)}/keys`,
      {
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      }
    ).catch(() => undefined);
    if (res == null) {
      // True network error — no response was received, so nothing was processed
      // server-side. Safe to retry.
      setSubmitting(false);
      setApiError('Could not add the property keys.');
      return;
    }

    // Parse the body separately from the request. A successful response with an
    // empty/unparseable body (e.g. 204 or a proxy page) must NOT be treated as a
    // failure: the keys may already have been added server-side, and surfacing an
    // error here would invite a duplicate add.
    const resBody: { message?: string } | undefined = await res
      .json()
      .catch(() => undefined);

    setSubmitting(false);

    if (!res.ok || isErrorRes(resBody)) {
      setApiError(
        (isErrorRes(resBody) ? resBody.message : undefined) ??
          'Could not add the property keys.'
      );
      return;
    }

    onAdded();
    reset();
    onClose();
  }

  return (
    <Dialog fullWidth onClose={handleClose} open={open}>
      <DialogTitle>Add Property Key(s)</DialogTitle>
      <DialogContent>
        {apiError != null && (
          <Alert severity="error" sx={{ mb: 1, mt: 1 }}>
            {apiError}
          </Alert>
        )}
        {validationError != null && (
          <Alert severity="error" sx={{ mb: 1, mt: 1 }}>
            {validationError}
          </Alert>
        )}
        <Box sx={{ mt: 1 }}>
          <Typography variant="subtitle2">Property Keys</Typography>
          <Typography color="text.secondary" variant="body2">
            {CaseSensitivityHelperText}
          </Typography>
          <Stack spacing={1} sx={{ mt: 1 }}>
            {keys.map((key, index) => (
              <Box key={index} sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
                <TextField
                  fullWidth
                  inputProps={{ 'aria-label': `Property key ${index + 1}` }}
                  label={`Property key ${index + 1}`}
                  onChange={(e) => handleKeyChange(index, e.target.value)}
                  size="small"
                  type="text"
                  value={key}
                />
                <IconButton
                  aria-label={`Remove property key ${index + 1}`}
                  onClick={() => handleRemoveKey(index)}
                >
                  <Delete />
                </IconButton>
              </Box>
            ))}
          </Stack>
          <Button onClick={handleAddKey} startIcon={<Add />} sx={{ mt: 1 }}>
            Add Property Key
          </Button>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          color="primary"
          disabled={submitDisabled}
          onClick={() => void handleSubmit()}
          variant="contained"
        >
          Add
        </Button>
      </DialogActions>
    </Dialog>
  );
}
