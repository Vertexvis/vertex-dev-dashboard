import { Add, Delete } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormLabel,
  IconButton,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import React from "react";

import { isErrorRes } from "../../lib/api";
import {
  CreatePropertyKeyPolicyReq,
  CreatePropertyKeyPolicyRes,
  PropertyKeyPolicyMode,
} from "../../lib/property-key-policies";

interface Props {
  readonly onClose: () => void;
  readonly onCreated: () => void;
  readonly open: boolean;
}

const CaseSensitivityHelperText =
  "Metadata property keys are case-sensitive and are saved exactly as typed.";

export default function CreatePropertyKeyPolicyDialog({
  onClose,
  onCreated,
  open,
}: Props): JSX.Element {
  const [name, setName] = React.useState("");
  const [suppliedId, setSuppliedId] = React.useState("");
  const [mode, setMode] = React.useState<PropertyKeyPolicyMode>(
    PropertyKeyPolicyMode.Allowlist
  );
  const [keys, setKeys] = React.useState<string[]>([""]);
  const [submitting, setSubmitting] = React.useState(false);
  const [validationError, setValidationError] = React.useState<string>();
  const [apiError, setApiError] = React.useState<string>();
  const [entriesWarning, setEntriesWarning] = React.useState<string>();

  function reset() {
    setName("");
    setSuppliedId("");
    setMode(PropertyKeyPolicyMode.Allowlist);
    setKeys([""]);
    setSubmitting(false);
    setValidationError(undefined);
    setApiError(undefined);
    setEntriesWarning(undefined);
  }

  // Once the policy has been created (even if its entries failed), re-submitting
  // would create a DUPLICATE policy. Track that state so the partial-failure
  // path replaces "Create" with "Close" and forces the user to dismiss.
  const policyCreated = entriesWarning != null;

  function handleClose() {
    if (submitting) return;
    reset();
    onClose();
  }

  function handleKeyChange(index: number, value: string) {
    setKeys((current) => current.map((k, i) => (i === index ? value : k)));
  }

  function handleAddKey() {
    setKeys((current) => [...current, ""]);
  }

  function handleRemoveKey(index: number) {
    setKeys((current) =>
      current.length === 1 ? [""] : current.filter((_, i) => i !== index)
    );
  }

  // Keys are NOT trimmed here to preserve case exactly. We only skip entries
  // that are empty or whitespace-only when deciding what to submit.
  const nonEmptyKeys = keys.filter((k) => k.trim() !== "");
  const submitDisabled =
    submitting || name.trim() === "" || nonEmptyKeys.length === 0;

  async function handleSubmit() {
    setValidationError(undefined);
    setApiError(undefined);
    setEntriesWarning(undefined);

    if (name.trim() === "") {
      setValidationError("Name is required.");
      return;
    }
    if (nonEmptyKeys.length === 0) {
      setValidationError("Add at least one property key.");
      return;
    }

    const trimmedSuppliedId = suppliedId.trim();
    const body: CreatePropertyKeyPolicyReq = {
      keys: nonEmptyKeys,
      mode,
      name: name.trim(),
      ...(trimmedSuppliedId !== "" ? { suppliedId: trimmedSuppliedId } : {}),
    };

    setSubmitting(true);

    let res: Response;
    let resBody: CreatePropertyKeyPolicyRes | { message?: string };
    try {
      res = await fetch("/api/property-key-policies", {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      resBody = await res.json();
    } catch {
      setSubmitting(false);
      setApiError("Could not create the property key policy.");
      return;
    }

    setSubmitting(false);

    if (!res.ok || isErrorRes(resBody)) {
      setApiError(
        (isErrorRes(resBody) ? resBody.message : undefined) ??
          "Could not create the property key policy."
      );
      return;
    }

    const entriesError = (resBody as CreatePropertyKeyPolicyRes).entriesError;
    // Always refresh the list so the newly created policy is visible.
    onCreated();

    if (entriesError != null) {
      // Policy was created but its keys failed. Keep the dialog open and warn.
      setEntriesWarning(entriesError);
      return;
    }

    reset();
    onClose();
  }

  return (
    <Dialog fullWidth onClose={handleClose} open={open}>
      <DialogTitle>Create Property Key Policy</DialogTitle>
      <DialogContent>
        {apiError != null && (
          <Alert severity="error" sx={{ mb: 1, mt: 1 }}>
            {apiError}
          </Alert>
        )}
        {entriesWarning != null && (
          <Alert severity="warning" sx={{ mb: 1, mt: 1 }}>
            {`The policy was created, but its property keys could not be added: ${entriesWarning} The keys were not saved. Close this dialog to avoid creating a duplicate policy.`}
          </Alert>
        )}
        {validationError != null && (
          <Alert severity="error" sx={{ mb: 1, mt: 1 }}>
            {validationError}
          </Alert>
        )}
        <TextField
          error={validationError != null && name.trim() === ""}
          fullWidth
          label="Name"
          margin="normal"
          onChange={(e) => setName(e.target.value)}
          required
          size="small"
          type="text"
          value={name}
        />
        <TextField
          fullWidth
          label="Supplied ID"
          margin="normal"
          onChange={(e) => setSuppliedId(e.target.value)}
          size="small"
          type="text"
          value={suppliedId}
        />
        <FormControl margin="normal">
          <FormLabel id="property-key-policy-mode-label">Mode</FormLabel>
          <RadioGroup
            aria-labelledby="property-key-policy-mode-label"
            name="property-key-policy-mode"
            onChange={(e) => setMode(e.target.value as PropertyKeyPolicyMode)}
            row
            value={mode}
          >
            <FormControlLabel
              control={<Radio />}
              label="Allow"
              value={PropertyKeyPolicyMode.Allowlist}
            />
            <FormControlLabel
              control={<Radio />}
              label="Deny"
              value={PropertyKeyPolicyMode.Denylist}
            />
          </RadioGroup>
        </FormControl>
        <Box sx={{ mt: 1 }}>
          <Typography variant="subtitle2">Property Keys</Typography>
          <Typography color="text.secondary" variant="body2">
            {CaseSensitivityHelperText}
          </Typography>
          <Stack spacing={1} sx={{ mt: 1 }}>
            {keys.map((key, index) => (
              <Box
                key={index}
                sx={{ alignItems: "center", display: "flex", gap: 1 }}
              >
                <TextField
                  fullWidth
                  inputProps={{ "aria-label": `Property key ${index + 1}` }}
                  label={`Property key ${index + 1}`}
                  onChange={(e) => handleKeyChange(index, e.target.value)}
                  size="small"
                  type="text"
                  value={key}
                />
                <IconButton
                  aria-label={`Remove property key ${index + 1}`}
                  onClick={() => handleRemoveKey(index)}
                >
                  <Delete />
                </IconButton>
              </Box>
            ))}
          </Stack>
          <Button onClick={handleAddKey} startIcon={<Add />} sx={{ mt: 1 }}>
            Add Property Key
          </Button>
        </Box>
      </DialogContent>
      <DialogActions>
        {policyCreated ? (
          // The policy already exists; only offer a Close action so the user
          // cannot accidentally create a duplicate by re-submitting.
          <Button color="primary" onClick={handleClose} variant="contained">
            Close
          </Button>
        ) : (
          <>
            <Button onClick={handleClose}>Cancel</Button>
            <Button
              color="primary"
              disabled={submitDisabled}
              onClick={handleSubmit}
              variant="contained"
            >
              Create
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
