import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Typography,
} from "@mui/material";

import { toLocaleString } from "../../lib/dates";
import { FileCollection } from "../../lib/file-collections";
import { toDisplayValue } from "../../lib/formatting";

interface Props {
  readonly fileCollection: FileCollection;
  readonly optionalFieldStatus?: "loading" | "ready";
}

export function FileCollectionMetadataTable({
  fileCollection,
  optionalFieldStatus = "ready",
}: Props): JSX.Element {
  return (
    <TableContainer>
      <Table size="small" sx={{ whiteSpace: "nowrap" }}>
        <TableBody>
          <DetailsRow label="Name" value={fileCollection.name} />
          <DetailsRow label="ID" value={fileCollection.id} />
          <DetailsRow label="Supplied ID" value={fileCollection.suppliedId} />
          <DetailsRow
            label="Created"
            value={toLocaleString(fileCollection.created)}
          />
          <DetailsRow
            label="Expires"
            value={toLocaleString(fileCollection.expiresAt)}
            status={optionalFieldStatus}
          />
          <MetadataRow
            metadata={fileCollection.metadata}
            status={optionalFieldStatus}
          />
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function DetailsRow({
  label,
  status,
  value,
}: {
  readonly label: string;
  readonly status?: "loading" | "ready";
  readonly value?: string;
}): JSX.Element {
  const displayValue =
    status === "loading" && value == null
      ? "Loading..."
      : toDisplayValue(value);

  return (
    <TableRow>
      <TableCell>
        <Typography variant="subtitle2">{label}</Typography>
        <Typography
          sx={{ overflowWrap: "anywhere", whiteSpace: "normal" }}
          variant="body2"
        >
          {displayValue}
        </Typography>
      </TableCell>
    </TableRow>
  );
}

function MetadataRow({
  metadata,
  status,
}: {
  readonly metadata?: Record<string, string>;
  readonly status: "loading" | "ready";
}): JSX.Element {
  const entries = metadata == null ? [] : Object.entries(metadata);

  return (
    <TableRow>
      <TableCell>
        <Typography variant="subtitle2">Metadata</Typography>
        {entries.length > 0 ? (
          <Box
            sx={{
              display: "grid",
              gap: 1,
              gridTemplateColumns: "minmax(0, 40%) minmax(0, 1fr)",
              mt: 1,
            }}
          >
            <Typography variant="subtitle2">Key</Typography>
            <Typography variant="subtitle2">Value</Typography>
            {entries.flatMap(([key, value]) => [
              <Typography
                key={`${key}-key`}
                sx={{ overflowWrap: "anywhere", whiteSpace: "normal" }}
                variant="body2"
              >
                {toDisplayValue(key)}
              </Typography>,
              <Typography
                key={`${key}-value`}
                sx={{ overflowWrap: "anywhere", whiteSpace: "normal" }}
                variant="body2"
              >
                {toDisplayValue(value)}
              </Typography>,
            ])}
          </Box>
        ) : (
          <Typography
            sx={{ overflowWrap: "anywhere", whiteSpace: "normal" }}
            variant="body2"
          >
            {status === "loading" ? "Loading..." : "N/A"}
          </Typography>
        )}
      </TableCell>
    </TableRow>
  );
}
