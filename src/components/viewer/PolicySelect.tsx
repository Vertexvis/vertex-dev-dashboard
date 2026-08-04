import {
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import { PropertyKeyPolicyData } from '@vertexvis/api-client-node';
import React from 'react';
import useSWR from 'swr';

import { GetRes, jsonFetcher } from '../../lib/api';
import { PropertyKeyPolicy, toPolicyPage } from '../../lib/property-key-policies';

interface Props {
  readonly policyId?: string;
  readonly onChange: (policyId?: string) => void;
  readonly disabled?: boolean;
}

// In-viewer policy switcher: displays the active property key policy and lets a
// developer switch it while viewing a scene (for RSK validation). Keeps the
// policy lookup local to the viewer — SceneTable owns its own copy.
export function PolicySelect({
  policyId,
  onChange,
  disabled = false,
}: Props): JSX.Element {
  const { data, error } = useSWR<GetRes<PropertyKeyPolicyData>>(
    '/api/property-key-policies',
    jsonFetcher
  );
  const loading = !data && !error;
  const policies: PropertyKeyPolicy[] = data ? toPolicyPage(data).items : [];

  return (
    <FormControl
      variant="standard"
      size="small"
      sx={{ minWidth: '14rem' }}
      disabled={disabled || loading || !!error}
    >
      <InputLabel id="viewer-policy-select-label">Property Key Policy</InputLabel>
      <Select
        labelId="viewer-policy-select-label"
        id="viewer-policy-select"
        value={policyId ?? ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        endAdornment={loading ? <CircularProgress size={16} sx={{ mr: 2 }} /> : undefined}
      >
        <MenuItem value="">
          <em>None (unrestricted)</em>
        </MenuItem>
        {policies.map((policy) => (
          <MenuItem key={policy.id} value={policy.id}>
            {policy.name ?? policy.suppliedId ?? policy.id}{' '}
            <Typography
              component="span"
              variant="caption"
              color="text.secondary"
              sx={{ ml: 0.5 }}
            >
              ({policy.mode})
            </Typography>
          </MenuItem>
        ))}
      </Select>
      {error && (
        <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
          Could not load policies
        </Typography>
      )}
    </FormControl>
  );
}
