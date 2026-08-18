import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import {
  Box,
  Button,
  CircularProgress,
  FormControl,
  IconButton,
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
  /** Keeps the control within the viewer header's single toolbar row. */
  readonly compact?: boolean;
  readonly width?: string;
}

// Shared policy switcher for the scene table and in-viewer RSK validation.
export function PolicySelect({
  policyId,
  onChange,
  disabled = false,
  compact = false,
  width,
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
  const paginationDisabled = disabled || loading || isValidating;
  const previousDisabled = paginationDisabled || currentPage === 0;
  const nextDisabled = paginationDisabled || error != null || cursors?.next == null;
  const selectorWidth = width ?? (compact ? '11rem' : '14rem');
  const label = compact ? 'Policy' : 'Property Key Policy';

  const paginationControls = compact ? (
    <Box sx={{ display: 'flex', flexShrink: 0 }}>
      <IconButton
        aria-label="Previous policy page"
        disabled={previousDisabled}
        onClick={() => handlePageChange(currentPage - 1)}
        size="small"
      >
        <ChevronLeftIcon fontSize="small" />
      </IconButton>
      <IconButton
        aria-label="Next policy page"
        disabled={nextDisabled}
        onClick={() => handlePageChange(currentPage + 1)}
        size="small"
      >
        <ChevronRightIcon fontSize="small" />
      </IconButton>
    </Box>
  ) : (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
      <Button
        aria-label="Previous policy page"
        disabled={previousDisabled}
        onClick={() => handlePageChange(currentPage - 1)}
        size="small"
      >
        Previous
      </Button>
      <Button
        aria-label="Next policy page"
        disabled={nextDisabled}
        onClick={() => handlePageChange(currentPage + 1)}
        size="small"
      >
        Next
      </Button>
    </Box>
  );

  return (
    <Box sx={{ width: selectorWidth }}>
      <Box sx={{ alignItems: 'center', display: 'flex' }}>
        <FormControl
          variant="standard"
          size="small"
          fullWidth
          disabled={controlsDisabled}
          sx={{ minWidth: 0 }}
        >
          <InputLabel id="viewer-policy-select-label">{label}</InputLabel>
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
        {compact && paginationControls}
      </Box>
      {!compact && paginationControls}
    </Box>
  );
}
