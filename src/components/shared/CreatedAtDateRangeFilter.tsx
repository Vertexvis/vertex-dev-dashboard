import { Box, TextField } from "@mui/material";
import React from "react";

import { toLocalDayBoundaryIso } from "../../lib/dates";

export interface CreatedAtDateRange {
  readonly createdAtEnd?: string;
  readonly createdAtStart?: string;
}

interface Props {
  readonly onChange: (filters: CreatedAtDateRange) => void;
}

function isAfter(left: string, right: string): boolean {
  return left.localeCompare(right) > 0;
}

export function CreatedAtDateRangeFilter({ onChange }: Props): JSX.Element {
  const [createdAtStartDate, setCreatedAtStartDate] = React.useState("");
  const [createdAtEndDate, setCreatedAtEndDate] = React.useState("");

  function handleCreatedAtStartChange(value: string) {
    const nextEndDate =
      value !== "" &&
      createdAtEndDate !== "" &&
      isAfter(value, createdAtEndDate)
        ? ""
        : createdAtEndDate;

    setCreatedAtStartDate(value);
    setCreatedAtEndDate(nextEndDate);
    onChange({
      createdAtEnd: nextEndDate
        ? toLocalDayBoundaryIso(nextEndDate, "end")
        : undefined,
      createdAtStart: value ? toLocalDayBoundaryIso(value, "start") : undefined,
    });
  }

  function handleCreatedAtEndChange(value: string) {
    const nextStartDate =
      value !== "" &&
      createdAtStartDate !== "" &&
      isAfter(createdAtStartDate, value)
        ? ""
        : createdAtStartDate;

    setCreatedAtStartDate(nextStartDate);
    setCreatedAtEndDate(value);
    onChange({
      createdAtEnd: value ? toLocalDayBoundaryIso(value, "end") : undefined,
      createdAtStart: nextStartDate
        ? toLocalDayBoundaryIso(nextStartDate, "start")
        : undefined,
    });
  }

  return (
    <Box
      sx={{
        px: { sm: 2 },
        pb: 2,
        display: "flex",
        gap: 2,
        flexWrap: "wrap",
      }}
    >
      <TextField
        variant="standard"
        size="small"
        margin="normal"
        id="createdAtStart"
        label="Created From"
        type="date"
        InputLabelProps={{ shrink: true }}
        inputProps={{ max: createdAtEndDate || undefined }}
        value={createdAtStartDate}
        onChange={(e) => handleCreatedAtStartChange(e.target.value)}
        sx={{ mt: 0, width: "16rem" }}
      />
      <TextField
        variant="standard"
        size="small"
        margin="normal"
        id="createdAtEnd"
        label="Created To"
        type="date"
        InputLabelProps={{ shrink: true }}
        inputProps={{ min: createdAtStartDate || undefined }}
        value={createdAtEndDate}
        onChange={(e) => handleCreatedAtEndChange(e.target.value)}
        sx={{ mt: 0, width: "16rem" }}
      />
    </Box>
  );
}
