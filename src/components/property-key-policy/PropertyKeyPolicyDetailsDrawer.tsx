import { Close } from '@mui/icons-material';
import { Box, Drawer, IconButton, Typography } from '@mui/material';
import React from 'react';
import useSWR from 'swr';

import { isErrorRes } from '../../lib/api';
import {
  GetPropertyKeyPolicyKeysRes,
  PropertyKeyPolicy,
  toPropertyKeyPolicyKey,
} from '../../lib/property-key-policies';
import { AppLink } from '../shared/AppLink';
import { RightDrawerWidth } from '../shared/Layout';
import { PropertyKeyPolicyKeysList } from './PropertyKeyPolicyKeysList';
import { PropertyKeyPolicyMetadataTable } from './PropertyKeyPolicyMetadataTable';

interface Props {
  readonly onClose: () => void;
  readonly open: boolean;
  readonly propertyKeyPolicy?: PropertyKeyPolicy;
}

export function PropertyKeyPolicyDetailsDrawer({
  onClose,
  open,
  propertyKeyPolicy,
}: Props): JSX.Element {
  const id = propertyKeyPolicy?.id;
  // The row prop already carries every attribute the metadata table renders, so
  // we only need to fetch the policy's keys. Avoid a redundant single-policy
  // GET (and its misleading error state) by rendering attributes from the prop.
  const { data: keysData, error: keysError } = useSWR<
    GetPropertyKeyPolicyKeysRes | undefined
  >(id == null ? null : `/api/property-key-policies/${encodeURIComponent(id)}/keys`);

  const details = propertyKeyPolicy;

  const keysFailed = keysError != null || isErrorRes(keysData);
  const keys =
    keysData != null && !isErrorRes(keysData)
      ? keysData.data.map(toPropertyKeyPolicyKey)
      : undefined;
  const keysLoading = id != null && keys == null && !keysFailed;

  return (
    <Drawer
      anchor="right"
      open={open}
      sx={{
        flexShrink: 0,
        width: RightDrawerWidth,
        '& .MuiDrawer-paper': { width: RightDrawerWidth },
      }}
      variant="persistent"
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography sx={{ my: 2, mx: 2 }} variant="h5">
          Property Key Policy
        </Typography>
        <IconButton aria-label="Close" onClick={onClose} sx={{ mr: 2 }}>
          <Close />
        </IconButton>
      </Box>
      {details ? (
        <Box sx={{ px: 2, pb: 2 }}>
          <PropertyKeyPolicyMetadataTable propertyKeyPolicy={details} />
          <PropertyKeyPolicyKeysList
            keys={keys}
            error={keysFailed}
            loading={keysLoading}
          />
          {id != null && (
            <Box sx={{ mt: 2 }}>
              <AppLink
                href={`/property-key-policies/${encodeURIComponent(id)}`}
                underline="hover"
              >
                View full details
              </AppLink>
            </Box>
          )}
        </Box>
      ) : (
        <></>
      )}
    </Drawer>
  );
}
