import { List, ListItem, ListItemText, Skeleton, Typography } from '@mui/material';

import { PropertyKeyPolicyKey } from '../../lib/property-key-policies';

interface Props {
  readonly keys?: readonly PropertyKeyPolicyKey[];
  readonly error?: boolean;
  readonly loading?: boolean;
}

export function PropertyKeyPolicyKeysList({
  keys,
  error = false,
  loading = false,
}: Props): JSX.Element {
  return (
    <>
      <Typography sx={{ mt: 2 }} variant="subtitle2">
        Property Keys
      </Typography>
      <Typography color="text.secondary" variant="caption">
        Metadata property keys are case-sensitive.
      </Typography>
      {renderBody({ keys: keys ?? [], error, loading })}
    </>
  );
}

function renderBody({
  keys,
  error,
  loading,
}: {
  readonly keys: readonly PropertyKeyPolicyKey[];
  readonly error: boolean;
  readonly loading: boolean;
}): JSX.Element {
  if (error) {
    return (
      <Typography color="error.main" variant="body2">
        Could not load property keys.
      </Typography>
    );
  }

  if (loading) {
    return (
      <>
        <Skeleton />
        <Skeleton />
      </>
    );
  }

  if (keys.length === 0) {
    return (
      <Typography color="text.secondary" variant="body2">
        No property keys.
      </Typography>
    );
  }

  return (
    <List dense disablePadding>
      {keys.map((key) => (
        <ListItem disableGutters key={key.id}>
          <ListItemText
            primary={key.name}
            primaryTypographyProps={{
              sx: { overflowWrap: 'anywhere', whiteSpace: 'normal' },
              variant: 'body2',
            }}
          />
        </ListItem>
      ))}
    </List>
  );
}
