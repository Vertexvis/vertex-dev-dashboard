import {
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import type { PropertyKeyPolicyData } from '@vertexvis/api-client-node';
import React from 'react';
import useSWR from 'swr';

import { type GetRes, jsonFetcher } from '../../lib/api';
import { buildQuery, useCursorPagingState } from '../../lib/paging';
import { type PropertyKeyPolicy, toPolicyPage } from '../../lib/property-key-policies';

// Keep this deliberately separate from table page sizes. The selector needs a
// useful number of choices per request without attempting to load every policy.
export const PropertyKeyPolicySelectPageSize = 50;

interface Props {
  readonly policyId?: string;
  readonly onChange: (policyId?: string) => void;
  readonly disabled?: boolean;
  readonly width?: string;
}

// Shared policy switcher for the scene table and in-viewer RSK validation.
export function PolicySelect({
  policyId,
  onChange,
  disabled = false,
  width = '14rem',
}: Props): JSX.Element {
  const { currentPage, cursor, cursors, handlePageChange, setCursors } =
    useCursorPagingState();
  const { data, error, isValidating } = useSWR<GetRes<PropertyKeyPolicyData>>(
    buildQuery('/api/property-key-policies', {
      cursor,
      pageSize: PropertyKeyPolicySelectPageSize,
    }),
    jsonFetcher
  );
  const loading = !data && !error;
  const policyPage = React.useMemo(() => (data ? toPolicyPage(data) : undefined), [data]);
  const policies: PropertyKeyPolicy[] = policyPage?.items ?? [];
  const pageCursors = policyPage?.cursors ?? undefined;
  const selectedPolicyIsOnPage =
    policyId != null && policies.some(({ id }) => id === policyId);

  React.useEffect(() => {
    setCursors(pageCursors);
  }, [pageCursors, setCursors]);

  const controlsDisabled = disabled || loading || error != null;
  const paginationDisabled = controlsDisabled || isValidating;

  return (
    <Box sx={{ width }}>
      <FormControl variant="standard" size="small" fullWidth disabled={controlsDisabled}>
        <InputLabel id="viewer-policy-select-label">Property Key Policy</InputLabel>
        <Select
          labelId="viewer-policy-select-label"
          id="viewer-policy-select"
          value={policyId ?? ''}
          onChange={(e) => onChange(e.target.value || undefined)}
          endAdornment={
            loading ? <CircularProgress size={16} sx={{ mr: 2 }} /> : undefined
          }
        >
          <MenuItem value="">
            <em>None (unrestricted)</em>
          </MenuItem>
          {policyId != null && !selectedPolicyIsOnPage && (
            <MenuItem value={policyId}>Current policy ({policyId})</MenuItem>
          )}
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
        <Button
          aria-label="Previous policy page"
          disabled={paginationDisabled || currentPage === 0}
          onClick={() => handlePageChange(currentPage - 1)}
          size="small"
        >
          Previous
        </Button>
        <Button
          aria-label="Next policy page"
          disabled={paginationDisabled || cursors?.next == null}
          onClick={() => handlePageChange(currentPage + 1)}
          size="small"
        >
          Next
        </Button>
      </Box>
    </Box>
  );
}
