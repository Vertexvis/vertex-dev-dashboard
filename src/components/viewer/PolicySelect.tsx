import {
  Box,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import type { PropertyKeyPolicyData } from '@vertexvis/api-client-node';
import React from 'react';
import useSWRInfinite from 'swr/infinite';

import { type GetRes, jsonFetcher } from '../../lib/api';
import { buildQuery, toPage } from '../../lib/paging';
import { type PropertyKeyPolicy } from '../../lib/property-key-policies';

// Keep this deliberately separate from table page sizes. The selector needs a
// useful number of choices per request without attempting to load every policy.
export const PropertyKeyPolicySelectPageSize = 50;

// Distance (px) from the bottom of the open menu at which we begin fetching the
// next page, so more options are ready before the user reaches the end.
const LoadMoreThresholdPx = 48;

type PolicyPageRes = GetRes<PropertyKeyPolicyData>;

interface Props {
  readonly policyId?: string;
  readonly onChange: (policyId?: string) => void;
  readonly disabled?: boolean;
  /** Keeps the control within the viewer header's single toolbar row. */
  readonly compact?: boolean;
  readonly width?: string;
}

// Shared policy switcher for the scene table and in-viewer RSK validation.
// Options load a page at a time and additional pages are fetched automatically
// as the user scrolls toward the bottom of the open dropdown.
export function PolicySelect({
  policyId,
  onChange,
  disabled = false,
  compact = false,
  width,
}: Props): JSX.Element {
  const { data, error, size, setSize, isValidating } = useSWRInfinite<PolicyPageRes>(
    (pageIndex, previousPage: PolicyPageRes | null) => {
      // Reached the end: the previous page reported no `next` cursor.
      if (previousPage && previousPage.cursors?.next == null && pageIndex > 0)
        return null;

      const cursor = pageIndex === 0 ? undefined : previousPage?.cursors?.next;
      return buildQuery('/api/property-key-policies', {
        cursor,
        pageSize: PropertyKeyPolicySelectPageSize,
      });
    },
    jsonFetcher,
    // Cursor pages are append-only; avoid refetching the whole list on focus.
    { revalidateFirstPage: false, revalidateOnFocus: false }
  );

  const loading = !data && !error;
  const policies: PropertyKeyPolicy[] = React.useMemo(
    () =>
      (data ?? []).flatMap(
        (page) =>
          toPage<PropertyKeyPolicyData, PropertyKeyPolicyData['attributes']>(page).items
      ),
    [data]
  );

  const lastPage = data?.[data.length - 1];
  const hasMore = error == null && (data == null || lastPage?.cursors?.next != null);
  // `data[size - 1] === undefined` while the page at the current size is still
  // in flight — the canonical SWR "loading more" signal.
  const isLoadingMore =
    loading || (size > 0 && data != null && data[size - 1] === undefined);

  const loadMore = React.useCallback(() => {
    if (hasMore && !isValidating) void setSize((current) => current + 1);
  }, [hasMore, isValidating, setSize]);

  const handleMenuScroll = React.useCallback(
    (event: React.UIEvent<HTMLElement>) => {
      const el = event.currentTarget;
      if (el.scrollHeight - el.scrollTop - el.clientHeight <= LoadMoreThresholdPx)
        loadMore();
    },
    [loadMore]
  );

  const selectedPolicyIsOnPage =
    policyId != null && policies.some(({ id }) => id === policyId);

  const controlsDisabled = disabled || loading || error != null;
  const selectorWidth = width ?? (compact ? '11rem' : '14rem');
  const label = compact ? 'Policy' : 'Property Key Policy';

  return (
    <Box sx={{ width: selectorWidth }}>
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
          MenuProps={{ PaperProps: { onScroll: handleMenuScroll } }}
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
          {isLoadingMore && !loading && (
            <MenuItem disabled sx={{ justifyContent: 'center' }}>
              <CircularProgress size={16} aria-label="Loading more policies" />
            </MenuItem>
          )}
        </Select>
        {error && (
          <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
            Could not load policies
          </Typography>
        )}
      </FormControl>
    </Box>
  );
}
