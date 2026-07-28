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
  const [apiError, setApiError] = React.useState<string>();
  const [entriesWarning, setEntriesWarning] = React.useState<string>();
  const [uncertainOutcome, setUncertainOutcome] = React.useState(false);

  // Refs to the underlying key inputs so we can move keyboard focus to a
  // newly added field. MUI forwards `inputRef` to the underlying <input>.
  const keyInputRefs = React.useRef<(HTMLInputElement | null)[]>([]);
  const [focusIndex, setFocusIndex] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (focusIndex == null) return;
    const el = keyInputRefs.current[focusIndex];
    if (el != null) {
      el.focus();
      setFocusIndex(null);
    }
  }, [focusIndex, keys]);

  function reset() {
    setName("");
    setSuppliedId("");
    setMode(PropertyKeyPolicyMode.Allowlist);
    setKeys([""]);
    setSubmitting(false);
    setApiError(undefined);
    setEntriesWarning(undefined);
    setUncertainOutcome(false);
  }

  // Once the policy has been created (even if its entries failed, or the response
  // could not be parsed), re-submitting would create a DUPLICATE policy. Track
  // that state so those paths replace "Create" with "Close" and force the user
  // to dismiss.
  const policyCreated = entriesWarning != null || uncertainOutcome;

  function handleClose() {
    if (submitting) return;
    reset();
    onClose();
  }

  function handleKeyChange(index: number, value: string) {
    setKeys((current) => current.map((k, i) => (i === index ? value : k)));
  }

  // Append a new empty key field and move keyboard focus to it. The new index
  // is the current length, since we append to the end.
  function addKeyAndFocus() {
    setFocusIndex(keys.length);
    setKeys((current) => [...current, ""]);
  }

  function handleAddKey() {
    addKeyAndFocus();
  }

  function handleKeyDown(
    e: React.KeyboardEvent<HTMLDivElement>,
    index: number,
    value: string
  ) {
    if (e.key !== "Enter") return;
    e.preventDefault();

    // Ignore Enter on whitespace-only fields; don't add a new field.
    if (value.trim() === "") return;

    // Case-sensitive exact match against the other key values. The field already
    // surfaces the per-field "Duplicate property key." error, so just bail.
    if (keys.some((k, i) => i !== index && k === value)) return;

    addKeyAndFocus();
  }

  function handleRemoveKey(index: number) {
    setKeys((current) =>
      current.length === 1 ? [""] : current.filter((_, i) => i !== index)
    );
  }

  // Compute a single field's validation error reactively (not just on submit).
  // A completely empty row is neutral (ignored on submit); only whitespace-only
  // or verbatim (case-sensitive) duplicate values are invalid.
  function keyFieldError(index: number): string | undefined {
    const value = keys[index];
    if (value === "") return undefined; // empty rows are neutral/ignored
    if (value.trim() === "") return "Property key cannot be blank."; // whitespace-only = invalid
    // Case-sensitive exact duplicate of another field (verbatim, matching how
    // keys are saved).
    if (keys.some((k, i) => i !== index && k === value)) {
      return "Duplicate property key.";
    }
    return undefined;
  }

  const keyErrors = keys.map((_, i) => keyFieldError(i));
  const hasKeyErrors = keyErrors.some((e) => e != null);

  // Keys are NOT trimmed here to preserve case exactly. We only skip entries
  // that are empty or whitespace-only when deciding what to submit.
  const nonEmptyKeys = keys.filter((k) => k.trim() !== "");
  const submitDisabled =
    submitting ||
    name.trim() === "" ||
    nonEmptyKeys.length === 0 ||
    hasKeyErrors;

  async function handleSubmit() {
    setApiError(undefined);
    setEntriesWarning(undefined);
    setUncertainOutcome(false);

    const trimmedSuppliedId = suppliedId.trim();
    const body: CreatePropertyKeyPolicyReq = {
      keys: nonEmptyKeys,
      mode,
      name: name.trim(),
      ...(trimmedSuppliedId !== "" ? { suppliedId: trimmedSuppliedId } : {}),
    };

    setSubmitting(true);

    let res: Response;
    try {
      res = await fetch("/api/property-key-policies", {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
    } catch {
      // True network error — no response was received, so nothing was processed
      // server-side. Safe to retry.
      setSubmitting(false);
      setApiError("Could not create the property key policy.");
      return;
    }

    let resBody: CreatePropertyKeyPolicyRes | { message?: string };
    try {
      resBody = await res.json();
    } catch {
      // Response received but body could not be parsed. The server may have
      // already created the policy, so we must not let the user resubmit (duplicate
      // risk). Refresh the list in case the policy was created, and switch to the
      // Close-only state.
      onCreated();
      setSubmitting(false);
      setUncertainOutcome(true);
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
        {uncertainOutcome && (
          <Alert severity="warning" sx={{ mb: 1, mt: 1 }}>
            The request completed but the response could not be read. The policy
            may have been created — check the list before retrying.
          </Alert>
        )}
        <TextField
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
            Metadata property keys are{" "}
            <Box component="span" fontWeight="fontWeightBold">
              case-sensitive
            </Box>{" "}
            and are{" "}
            <Box component="span" fontWeight="fontWeightBold">
              saved exactly as typed
            </Box>
            .
          </Typography>
          <Stack spacing={1} sx={{ mt: 1 }}>
            {keys.map((key, index) => (
              <Box
                key={index}
                sx={{ alignItems: "center", display: "flex", gap: 1 }}
              >
                <TextField
                  error={keyErrors[index] != null}
                  fullWidth
                  helperText={keyErrors[index]}
                  inputProps={{ "aria-label": `Property key ${index + 1}` }}
                  inputRef={(el) => {
                    keyInputRefs.current[index] = el;
                  }}
                  label={`Property key ${index + 1}`}
                  onChange={(e) => handleKeyChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, index, key)}
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
