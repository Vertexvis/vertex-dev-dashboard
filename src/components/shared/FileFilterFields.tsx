import { Box, TextField } from "@mui/material";
import React from "react";

interface Props {
  readonly fileIdFieldId?: string;
  readonly nameFieldId?: string;
  readonly onFileIdChange: (value: string) => void;
  readonly onNameChange: (value: string) => void;
  readonly onSuppliedIdChange: (value: string) => void;
  readonly suppliedIdFieldId?: string;
}

/**
 * The Name / File ID / Supplied ID filter row shared by the Files page and
 * the file-collection files table. Change handlers receive the trimmed input
 * value. Field ids are configurable but default to the historical values
 * that tests reference.
 */
export function FileFilterFields({
  fileIdFieldId = "fileIdFilter",
  nameFieldId = "nameFilter",
  onFileIdChange,
  onNameChange,
  onSuppliedIdChange,
  suppliedIdFieldId = "suppliedIdFilter",
}: Props): JSX.Element {
  return (
    <Box
      sx={{
        px: { sm: 2 },
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 2,
        flexWrap: "wrap",
      }}
    >
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", flex: 1 }}>
        <TextField
          variant="standard"
          size="small"
          margin="normal"
          id={nameFieldId}
          label="Name"
          type="text"
          onChange={(e) => {
            onNameChange(e.target.value?.trim() ?? "");
          }}
          sx={{ mt: 0, width: "16rem" }}
        />
        <TextField
          variant="standard"
          size="small"
          margin="normal"
          id={fileIdFieldId}
          label="File ID"
          type="text"
          onChange={(e) => {
            onFileIdChange(e.target.value?.trim() ?? "");
          }}
          sx={{ mt: 0, width: "16rem" }}
        />
        <TextField
          variant="standard"
          size="small"
          margin="normal"
          id={suppliedIdFieldId}
          label="Supplied ID"
          type="text"
          onChange={(e) => {
            onSuppliedIdChange(e.target.value?.trim() ?? "");
          }}
          sx={{ mt: 0, width: "16rem" }}
        />
      </Box>
    </Box>
  );
}
