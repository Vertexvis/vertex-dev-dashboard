import { Add, Delete } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Skeleton,
  Snackbar,
  Typography,
} from '@mui/material';
import React from 'react';

import { isErrorRes } from '../../lib/api';
import {
  DeletePropertyKeyPolicyKeysReq,
  PropertyKeyPolicyKey,
} from '../../lib/property-key-policies';
import AddPropertyKeyPolicyEntryDialog from './AddPropertyKeyPolicyEntryDialog';

interface Props {
  readonly keys?: readonly PropertyKeyPolicyKey[];
  readonly error?: boolean;
  readonly loading?: boolean;
  // Editing is enabled only when BOTH `policyId` and `onMutate` are supplied.
  // The drawer omits them so the list stays read-only there.
  readonly onMutate?: () => void;
  readonly policyId?: string;
}

export function PropertyKeyPolicyKeysList({
  keys,
  error = false,
  loading = false,
  onMutate,
  policyId,
}: Props): JSX.Element {
  const editable = policyId != null && onMutate != null;

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string>();
  const [addOpen, setAddOpen] = React.useState(false);

  const resolvedEntries = keys ?? [];

  function handleCheck(id: string): void {
    setSelected((current) => {
      const upd = new Set(current);
      if (upd.has(id)) upd.delete(id);
      else upd.add(id);
      return upd;
    });
  }

  async function handleDelete(ids: string[]): Promise<void> {
    if (!editable || deleting || ids.length === 0) return;

    setDeleteError(undefined);
    setDeleting(true);

    const body: DeletePropertyKeyPolicyKeysReq = { ids };

    const res = await fetch(
      `/api/property-key-policies/${encodeURIComponent(policyId)}/keys`,
      {
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
        method: 'DELETE',
      }
    ).catch(() => undefined);
    if (res == null) {
      setDeleting(false);
      setDeleteError('Could not delete the selected property keys.');
      return;
    }

    if (!res.ok) {
      const errBody = await res.json().catch(() => undefined);
      const message = isErrorRes(errBody) ? errBody.message : undefined;
      setDeleting(false);
      setDeleteError(message ?? 'Could not delete the selected property keys.');
      return;
    }

    setDeleting(false);
    setSelected((cur) => {
      const upd = new Set(cur);
      ids.forEach((id) => upd.delete(id));
      return upd;
    });
    onMutate();
  }

  return (
    <>
      <Box
        sx={{
          alignItems: 'center',
          display: 'flex',
          justifyContent: 'space-between',
          mt: 2,
        }}
      >
        <Typography variant="subtitle2">Property Keys</Typography>
        {editable && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            {selected.size > 0 && (
              <Button
                color="error"
                disabled={deleting}
                onClick={() => void handleDelete([...selected])}
                size="small"
                startIcon={<Delete />}
              >
                {`Delete (${selected.size})`}
              </Button>
            )}
            <Button
              onClick={() => setAddOpen(true)}
              size="small"
              startIcon={<Add />}
              variant="contained"
            >
              Add property key(s)
            </Button>
          </Box>
        )}
      </Box>
      <Typography color="text.secondary" variant="caption">
        Metadata property keys are case-sensitive.
      </Typography>
      {renderBody({
        deleting,
        editable,
        entries: resolvedEntries,
        error,
        loading,
        onCheck: handleCheck,
        onDeleteOne: (id) => void handleDelete([id]),
        selected,
      })}
      {editable && (
        <>
          <AddPropertyKeyPolicyEntryDialog
            onAdded={() => onMutate()}
            onClose={() => setAddOpen(false)}
            open={addOpen}
            policyId={policyId}
          />
          <Snackbar
            autoHideDuration={6000}
            onClose={() => setDeleteError(undefined)}
            open={deleteError != null}
          >
            <Alert onClose={() => setDeleteError(undefined)} severity="error">
              {deleteError}
            </Alert>
          </Snackbar>
        </>
      )}
    </>
  );
}

function renderBody({
  deleting,
  editable,
  entries,
  error,
  loading,
  onCheck,
  onDeleteOne,
  selected,
}: {
  readonly deleting: boolean;
  readonly editable: boolean;
  readonly entries: readonly PropertyKeyPolicyKey[];
  readonly error: boolean;
  readonly loading: boolean;
  readonly onCheck: (id: string) => void;
  readonly onDeleteOne: (id: string) => void;
  readonly selected: Set<string>;
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
        <ListItem
          disableGutters
          key={entry.id}
          secondaryAction={
            editable ? (
              <IconButton
                aria-label={`Delete ${entry.name}`}
                disabled={deleting}
                edge="end"
                onClick={() => onDeleteOne(entry.id)}
              >
                <Delete />
              </IconButton>
            ) : undefined
          }
        >
          {editable && (
            <Checkbox
              checked={selected.has(entry.id)}
              color="primary"
              disabled={deleting}
              edge="start"
              inputProps={{ 'aria-label': `Select ${entry.name}` }}
              onChange={() => onCheck(entry.id)}
            />
          )}
          <ListItemText
            primary={entry.name}
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
