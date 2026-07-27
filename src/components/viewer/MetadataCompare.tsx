import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import React from "react";

import { Metadata } from "../../lib/metadata";
import {
  DrawerTitle,
  MetadataStatus,
  NoData,
  StateMessage,
} from "./MetadataStates";

interface Props {
  // Query = current panel data (viewer.sceneItems.listSceneItemMetadata).
  readonly metadata?: Metadata;
  // Stream = metadata delivered through the render stream on tap (hit.metadataProperties).
  // Undefined means no stream sample is available yet (tree selection, or a
  // policy switch before the item is re-tapped in the viewer).
  readonly streamMetadata?: Metadata;
  readonly status?: MetadataStatus;
  readonly error?: string;
  readonly diagnostic?: string;
}

// A row's relationship between the two metadata channels for one key.
export type CompareState = "match" | "diff" | "query-only" | "stream-only";

export interface CompareRow {
  readonly key: string;
  readonly queryValue?: string;
  readonly streamValue?: string;
  readonly state: CompareState;
}

const StreamUnavailableCaption =
  "Stream metadata appears when you click an item in the viewer.";

// Accessible, non-color-only label for each highlighted row state.
const StateLabel: Record<CompareState, string> = {
  match: "Match",
  diff: "Differs",
  "query-only": "Query only",
  "stream-only": "Stream only",
};

// MUI palette cues per state. `match` stays neutral; the rest are highlighted.
function stateBackground(state: CompareState): string | undefined {
  switch (state) {
    case "diff":
      return "warning.light";
    case "query-only":
      return "info.light";
    case "stream-only":
      return "secondary.light";
    default:
      return undefined;
  }
}

// Build one comparison row per key across the union of both sources. When the
// stream sample is unavailable, rows reflect only the query side (never falsely
// flagged as query-only).
export function buildCompareRows({
  metadata,
  streamMetadata,
}: {
  metadata?: Metadata;
  streamMetadata?: Metadata;
}): CompareRow[] {
  const query = metadata?.properties ?? {};
  const stream = streamMetadata?.properties ?? {};
  const streamAvailable = streamMetadata != null;

  const keys = Array.from(
    new Set([...Object.keys(query), ...Object.keys(stream)])
  ).sort((a, b) => a.localeCompare(b));

  return keys.map((key) => {
    const inQuery = Object.prototype.hasOwnProperty.call(query, key);
    const inStream = Object.prototype.hasOwnProperty.call(stream, key);
    const queryValue = query[key];
    const streamValue = stream[key];

    // Without a stream sample we only surface the query values; do not diff.
    if (!streamAvailable) {
      return { key, queryValue, streamValue: undefined, state: "match" };
    }

    let state: CompareState;
    if (inQuery && inStream) {
      state = queryValue === streamValue ? "match" : "diff";
    } else if (inQuery) {
      state = "query-only";
    } else {
      state = "stream-only";
    }

    return { key, queryValue, streamValue, state };
  });
}

export function MetadataCompare({
  metadata,
  streamMetadata,
  status = "ready",
  error,
  diagnostic,
}: Props): JSX.Element {
  if (status === "loading")
    return <StateMessage message="Loading metadata..." />;
  if (status === "error") {
    return <StateMessage message={error ?? "Failed to load metadata."} error />;
  }

  const streamAvailable = streamMetadata != null;
  const rows = buildCompareRows({ metadata, streamMetadata });

  if (rows.length === 0) return <NoData />;

  const diffCount = rows.filter((r) => r.state !== "match").length;

  return (
    <>
      <DrawerTitle />
      {diagnostic ? (
        <Typography
          role="status"
          sx={{ color: "warning.main", mx: 2, my: 1 }}
          variant="caption"
        >
          {diagnostic}
        </Typography>
      ) : null}
      <Typography
        role="status"
        sx={{ color: "text.secondary", display: "block", mx: 2, my: 1 }}
        variant="caption"
      >
        {streamAvailable
          ? diffCount === 1
            ? "1 difference"
            : `${diffCount} differences`
          : StreamUnavailableCaption}
      </Typography>
      <TableContainer sx={{ flexGrow: 1 }}>
        <Table sx={{ whiteSpace: "nowrap", tableLayout: "fixed" }} size="small">
          <TableHead>
            <TableRow>
              <TableCell>
                <Typography variant="subtitle2">Key</Typography>
              </TableCell>
              <TableCell>
                <Typography variant="subtitle2">Query</Typography>
              </TableCell>
              <TableCell>
                <Typography variant="subtitle2">Stream</Typography>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <CompareTableRow
                key={row.key}
                row={row}
                streamAvailable={streamAvailable}
              />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}

function CompareTableRow({
  row,
  streamAvailable,
}: {
  readonly row: CompareRow;
  readonly streamAvailable: boolean;
}): JSX.Element {
  const highlighted = row.state !== "match";
  const bg = stateBackground(row.state);

  return (
    <TableRow
      data-state={row.state}
      sx={bg ? { backgroundColor: bg } : undefined}
    >
      <TableCell>
        <Typography
          sx={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          variant="subtitle2"
        >
          {row.key}
        </Typography>
        {highlighted ? (
          // Accessible marker so state is not conveyed by color alone.
          <Typography
            sx={{ color: "text.secondary", display: "block" }}
            variant="caption"
          >
            {StateLabel[row.state]}
          </Typography>
        ) : null}
      </TableCell>
      <ValueCell value={row.queryValue} />
      <ValueCell value={streamAvailable ? row.streamValue : undefined} />
    </TableRow>
  );
}

function ValueCell({ value }: { readonly value?: string }): JSX.Element {
  return (
    <TableCell>
      <Tooltip title={value ?? ""} placement="left" enterDelay={500}>
        <Typography
          sx={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          variant="body2"
        >
          {value ?? "—"}
        </Typography>
      </Tooltip>
    </TableCell>
  );
}
