import {
  Alert,
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
} from '@mui/material';
import React from 'react';

import { isErrorRes } from '../../lib/api';
import {
  CreatePropertyKeyPolicyReq,
  CreatePropertyKeyPolicyRes,
  PropertyKeyPolicyMode,
} from '../../lib/property-key-policies';
import { PropertyKeyFields, usePropertyKeyFields } from './PropertyKeyFields';

interface Props {
  readonly onClose: () => void;
  readonly onCreated: () => void;
  readonly open: boolean;
}

export default function CreatePropertyKeyPolicyDialog({
  onClose,
  onCreated,
  open,
}: Props): JSX.Element {
  const [name, setName] = React.useState('');
  const [suppliedId, setSuppliedId] = React.useState('');
  const [mode, setMode] = React.useState<PropertyKeyPolicyMode>(
    PropertyKeyPolicyMode.Allowlist
  );
  const keyFields = usePropertyKeyFields();
  const [submitting, setSubmitting] = React.useState(false);
  const [apiError, setApiError] = React.useState<string>();
  const [entriesWarning, setEntriesWarning] = React.useState<string>();
  const [uncertainOutcome, setUncertainOutcome] = React.useState(false);

  function reset(): void {
    setName('');
    setSuppliedId('');
    setMode(PropertyKeyPolicyMode.Allowlist);
    keyFields.reset();
    setSubmitting(false);
    setApiError(undefined);
    setEntriesWarning(undefined);
    setUncertainOutcome(false);
  }

  // Once the policy has been created (even if its entries failed, or the response
  // could not be parsed), re-submitting would create a DUPLICATE policy. Track
  // that state so those paths replace "Create" with "Close" and force the user
  // to dismiss.
  const policyCreated = entriesWarning != null || uncertainOutcome;

  function handleClose(): void {
    if (submitting) return;
    reset();
    onClose();
  }

  const { nonEmptyKeys } = keyFields;
  const submitDisabled =
    submitting || name.trim() === '' || nonEmptyKeys.length === 0 || keyFields.hasErrors;

  async function handleSubmit(): Promise<void> {
    setApiError(undefined);
    setEntriesWarning(undefined);
    setUncertainOutcome(false);

    const trimmedSuppliedId = suppliedId.trim();
    const body: CreatePropertyKeyPolicyReq = {
      keys: nonEmptyKeys,
      mode,
      name: name.trim(),
      ...(trimmedSuppliedId !== '' ? { suppliedId: trimmedSuppliedId } : {}),
    };

    setSubmitting(true);

    const res = await fetch('/api/property-key-policies', {
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    }).catch(() => undefined);
    if (res == null) {
      // True network error — no response was received, so nothing was processed
      // server-side. Safe to retry.
      setSubmitting(false);
      setApiError('Could not create the property key policy.');
      return;
    }

    const resBody: CreatePropertyKeyPolicyRes | { message?: string } | undefined =
      await res.json().catch(() => undefined);
    if (resBody == null) {
      // Response received but body could not be parsed. The server may have
      // already created the policy, so we must not let the user resubmit (duplicate
      // risk). Refresh the list in case the policy was created, and switch to the
      // Close-only state.
      onCreated();
      setSubmitting(false);
      setUncertainOutcome(true);
      return;
    }

    setSubmitting(false);

    if (!res.ok || isErrorRes(resBody)) {
      setApiError(
        (isErrorRes(resBody) ? resBody.message : undefined) ??
          'Could not create the property key policy.'
      );
      return;
    }

    const keysError = (resBody as CreatePropertyKeyPolicyRes).keysError;
    // Always refresh the list so the newly created policy is visible.
    onCreated();

    if (keysError != null) {
      // Policy was created but its keys failed. Keep the dialog open and warn.
      setEntriesWarning(keysError);
      return;
    }

    reset();
    onClose();
  }

  return (
    <Dialog fullWidth onClose={handleClose} open={open}>
      <DialogTitle>Create Property Key Policy</DialogTitle>
      <DialogContent>
        {apiError != null && (
          <Alert severity="error" sx={{ mb: 1, mt: 1 }}>
            {apiError}
          </Alert>
        )}
        {entriesWarning != null && (
          <Alert severity="warning" sx={{ mb: 1, mt: 1 }}>
            {`The policy was created, but its property keys could not be added: ${entriesWarning} The keys were not saved. Close this dialog to avoid creating a duplicate policy.`}
          </Alert>
        )}
        {uncertainOutcome && (
          <Alert severity="warning" sx={{ mb: 1, mt: 1 }}>
            The request completed but the response could not be read. The policy may have
            been created — check the list before retrying.
          </Alert>
        )}
        <TextField
          fullWidth
          label="Name"
          margin="normal"
          onChange={(e) => setName(e.target.value)}
          required
          size="small"
          type="text"
          value={name}
        />
        <TextField
          fullWidth
          label="Supplied ID"
          margin="normal"
          onChange={(e) => setSuppliedId(e.target.value)}
          size="small"
          type="text"
          value={suppliedId}
        />
        <FormControl margin="normal">
          <FormLabel id="property-key-policy-mode-label">Mode</FormLabel>
          <RadioGroup
            aria-labelledby="property-key-policy-mode-label"
            name="property-key-policy-mode"
            onChange={(e) => setMode(e.target.value as PropertyKeyPolicyMode)}
            row
            value={mode}
          >
            <FormControlLabel
              control={<Radio />}
              label="Allow"
              value={PropertyKeyPolicyMode.Allowlist}
            />
            <FormControlLabel
              control={<Radio />}
              label="Deny"
              value={PropertyKeyPolicyMode.Denylist}
            />
          </RadioGroup>
        </FormControl>
        <PropertyKeyFields controller={keyFields} />
      </DialogContent>
      <DialogActions>
        {policyCreated ? (
          // The policy already exists; only offer a Close action so the user
          // cannot accidentally create a duplicate by re-submitting.
          <Button color="primary" onClick={handleClose} variant="contained">
            Close
          </Button>
        ) : (
          <>
            <Button onClick={handleClose}>Cancel</Button>
            <Button
              color="primary"
              disabled={submitDisabled}
              onClick={() => {
                handleSubmit().catch(() => {
                  setSubmitting(false);
                  setApiError('Could not create the property key policy.');
                });
              }}
              variant="contained"
            >
              Create
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
