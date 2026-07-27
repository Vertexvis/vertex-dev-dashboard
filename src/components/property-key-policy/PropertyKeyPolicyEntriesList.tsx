import {
  List,
  ListItem,
  ListItemText,
  Skeleton,
  Typography,
} from "@mui/material";

import { PropertyKeyPolicyEntry } from "../../lib/property-key-policies";

interface Props {
  readonly entries?: readonly PropertyKeyPolicyEntry[];
  readonly error?: boolean;
  readonly loading?: boolean;
}

export function PropertyKeyPolicyEntriesList({
  entries,
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
      {renderBody({ entries: entries ?? [], error, loading })}
    </>
  );
}

function renderBody({
  entries,
  error,
  loading,
}: {
  readonly entries: readonly PropertyKeyPolicyEntry[];
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

  if (entries.length === 0) {
    return (
      <Typography color="text.secondary" variant="body2">
        No property keys.
      </Typography>
    );
  }

  return (
    <List dense disablePadding>
      {entries.map((entry) => (
        <ListItem disableGutters key={entry.id}>
          <ListItemText
            primary={entry.name}
            primaryTypographyProps={{
              sx: { overflowWrap: "anywhere", whiteSpace: "normal" },
              variant: "body2",
            }}
          />
        </ListItem>
      ))}
    </List>
  );
}
