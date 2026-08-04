import { Add, Delete } from '@mui/icons-material';
import { Box, Button, IconButton, Stack, TextField, Typography } from '@mui/material';
import React from 'react';

export interface KeyField {
  readonly id: number;
  readonly value: string;
}

export interface UsePropertyKeyFieldsOptions {
  // Already-persisted key names to validate against (case-sensitive, verbatim).
  // Used by the add-to-existing-policy flow; defaults to none for creation.
  readonly existingKeys?: readonly string[];
}

export interface PropertyKeyFieldsController {
  readonly fields: readonly KeyField[];
  readonly fieldErrors: readonly (string | undefined)[];
  readonly hasErrors: boolean;
  // Non-empty values in field order, preserving case exactly (not trimmed).
  readonly nonEmptyKeys: string[];
  reset(): void;
  setFieldValue(index: number, value: string): void;
  addField(): void;
  removeField(index: number): void;
  handleFieldKeyDown(e: React.KeyboardEvent<HTMLDivElement>, index: number): void;
  registerInput(index: number, el: HTMLInputElement | null): void;
}

// Owns the list of property-key input fields and all of their behavior: stable
// ids for React keys + focus tracking, add/remove, Enter-to-add-and-focus, and
// reactive per-field validation (blank, case-sensitive duplicate, and — when
// `existingKeys` is supplied — "already on this policy"). Shared by the create
// and add-entry dialogs so both behave identically.
export function usePropertyKeyFields(
  options: UsePropertyKeyFieldsOptions = {}
): PropertyKeyFieldsController {
  const { existingKeys } = options;

  const nextKeyId = React.useRef(1);
  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);
  const [focusIndex, setFocusIndex] = React.useState<number | null>(null);
  const [fields, setFields] = React.useState<KeyField[]>([{ id: 0, value: '' }]);

  function newField(): KeyField {
    const id = nextKeyId.current;
    nextKeyId.current += 1;
    return { id, value: '' };
  }

  React.useEffect(() => {
    if (focusIndex == null) return;
    const el = inputRefs.current[focusIndex];
    if (el != null) {
      el.focus();
      setFocusIndex(null);
    }
  }, [focusIndex, fields]);

  // Reactive validation for a single field. An empty row is neutral (ignored on
  // submit); only whitespace-only, a case-sensitive duplicate of another field,
  // or a value that already exists on the policy is invalid.
  function fieldError(value: string, index: number): string | undefined {
    if (value === '') return undefined;
    if (value.trim() === '') return 'Property key cannot be blank.';
    if (fields.some((f, i) => i !== index && f.value === value)) {
      return 'Duplicate property key.';
    }
    if (existingKeys?.includes(value)) {
      return 'Property key already exists on this policy.';
    }
    return undefined;
  }

  function setFieldValue(index: number, value: string): void {
    setFields((current) => current.map((f, i) => (i === index ? { ...f, value } : f)));
  }

  // Append a new empty field and move keyboard focus to it. The new index is the
  // current length, since we append to the end.
  function addField(): void {
    setFocusIndex(fields.length);
    setFields((current) => [...current, newField()]);
  }

  function removeField(index: number): void {
    setFields((current) =>
      current.length === 1 ? [newField()] : current.filter((_, i) => i !== index)
    );
  }

  function handleFieldKeyDown(
    e: React.KeyboardEvent<HTMLDivElement>,
    index: number
  ): void {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    // Don't add a new field when the current value is invalid (blank, duplicate,
    // or already on the policy); the field already surfaces the error.
    if (fieldError(fields[index].value, index) != null) return;
    // Also ignore a completely empty field — nothing to commit.
    if (fields[index].value.trim() === '') return;
    addField();
  }

  function registerInput(index: number, el: HTMLInputElement | null): void {
    inputRefs.current[index] = el;
  }

  function reset(): void {
    setFields([newField()]);
    setFocusIndex(null);
  }

  const fieldErrors = fields.map((f, i) => fieldError(f.value, i));
  const hasErrors = fieldErrors.some((e) => e != null);
  const nonEmptyKeys = fields.map((f) => f.value).filter((v) => v.trim() !== '');

  return {
    addField,
    fieldErrors,
    fields,
    handleFieldKeyDown,
    hasErrors,
    nonEmptyKeys,
    registerInput,
    removeField,
    reset,
    setFieldValue,
  };
}

// Presentational "Property Keys" editor driven by a controller from
// `usePropertyKeyFields`. Renders the case-sensitivity helper, the list of
// fields with per-field errors, and the "Add Property Key" button.
export function PropertyKeyFields({
  controller,
}: {
  readonly controller: PropertyKeyFieldsController;
}): JSX.Element {
  const { fields, fieldErrors } = controller;

  return (
    <Box sx={{ mt: 1 }}>
      <Typography variant="subtitle2">Property Keys</Typography>
      <Typography color="text.secondary" variant="body2">
        Metadata property keys are{' '}
        <Box component="span" fontWeight="fontWeightBold">
          case-sensitive
        </Box>{' '}
        and are{' '}
        <Box component="span" fontWeight="fontWeightBold">
          saved exactly as typed
        </Box>
        .
      </Typography>
      <Stack spacing={1} sx={{ mt: 1 }}>
        {fields.map((field, index) => (
          <Box key={field.id} sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
            <TextField
              error={fieldErrors[index] != null}
              fullWidth
              helperText={fieldErrors[index]}
              inputProps={{ 'aria-label': `Property key ${index + 1}` }}
              inputRef={(el) => controller.registerInput(index, el)}
              label={`Property key ${index + 1}`}
              onChange={(e) => controller.setFieldValue(index, e.target.value)}
              onKeyDown={(e) => controller.handleFieldKeyDown(e, index)}
              size="small"
              type="text"
              value={field.value}
            />
            <IconButton
              aria-label={`Remove property key ${index + 1}`}
              onClick={() => controller.removeField(index)}
            >
              <Delete />
            </IconButton>
          </Box>
        ))}
      </Stack>
      <Button onClick={() => controller.addField()} startIcon={<Add />} sx={{ mt: 1 }}>
        Add Property Key
      </Button>
    </Box>
  );
}
