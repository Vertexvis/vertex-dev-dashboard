import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material';
import React from 'react';

import { isErrorRes } from '../../lib/api';
import { AddPropertyKeyPolicyKeysReq } from '../../lib/property-key-policies';
import { PropertyKeyFields, usePropertyKeyFields } from './PropertyKeyFields';

interface Props {
  readonly onAdded: () => void;
  readonly onClose: () => void;
  readonly open: boolean;
  readonly policyId: string;
  // Names already on the policy, so the field editor can flag duplicates
  // (case-sensitive) before submitting.
  readonly existingKeys?: readonly string[];
}

export default function AddPropertyKeyPolicyEntryDialog({
  onAdded,
  onClose,
  open,
  policyId,
  existingKeys,
}: Props): JSX.Element {
  const keyFields = usePropertyKeyFields({ existingKeys });
  const [submitting, setSubmitting] = React.useState(false);
  const [apiError, setApiError] = React.useState<string>();

  function reset(): void {
    keyFields.reset();
    setSubmitting(false);
    setApiError(undefined);
  }

  function handleClose(): void {
    if (submitting) return;
    reset();
    onClose();
  }

  const { nonEmptyKeys } = keyFields;
  const submitDisabled = submitting || nonEmptyKeys.length === 0 || keyFields.hasErrors;

  async function handleSubmit(): Promise<void> {
    setApiError(undefined);

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
        <PropertyKeyFields controller={keyFields} />
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
