import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import React from 'react';

import { PolicySelect } from '../viewer/PolicySelect';

interface Props {
  readonly defaultPolicyId?: string;
  readonly loading: boolean;
  readonly onClose: () => void;
  readonly onGenerate: (policyId?: string) => void;
  readonly open: boolean;
}

/** Explicitly chooses whether a copied stream key should be policy-restricted. */
export function GenerateStreamKeyDialog({
  defaultPolicyId,
  loading,
  onClose,
  onGenerate,
  open,
}: Props): JSX.Element {
  const [policyId, setPolicyId] = React.useState<string | undefined>(defaultPolicyId);

  React.useEffect(() => {
    if (open) setPolicyId(defaultPolicyId);
  }, [defaultPolicyId, open]);

  return (
    <Dialog fullWidth maxWidth="xs" onClose={loading ? undefined : onClose} open={open}>
      <DialogTitle>Generate stream key</DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 2 }} variant="body2">
          Choose the property key policy to apply to this stream key. Unrestricted keys
          use your developer-session access.
        </Typography>
        <PolicySelect disabled={loading} onChange={setPolicyId} policyId={policyId} />
      </DialogContent>
      <DialogActions>
        <Button disabled={loading} onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={loading}
          onClick={() => onGenerate(policyId)}
          variant="contained"
        >
          Generate
        </Button>
      </DialogActions>
    </Dialog>
  );
}
