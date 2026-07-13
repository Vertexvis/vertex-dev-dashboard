import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
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
  value,
}: {
  readonly label: string;
  readonly status?: "loading" | "ready";
  readonly value?: string;
}): JSX.Element {
  const displayValue =
    status === "loading" && value == null ? "Loading..." : toDisplayValue(value);

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
          <Table size="small" sx={{ mt: 1, tableLayout: "fixed" }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ px: 0, py: 0.5, width: "40%", pr: 1 }}>
                  <Typography variant="subtitle2">Key</Typography>
                </TableCell>
                <TableCell sx={{ px: 0, py: 0.5, pl: 1 }}>
                  <Typography variant="subtitle2">Value</Typography>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map(([key, value]) => (
                <TableRow key={key}>
                  <TableCell sx={{ px: 0, py: 0.5, pr: 1 }}>
                    <Typography
                      sx={{ overflowWrap: "anywhere", whiteSpace: "normal" }}
                      variant="body2"
                    >
                      {toDisplayValue(key)}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ px: 0, py: 0.5, pl: 1 }}>
                    <Typography
                      sx={{ overflowWrap: "anywhere", whiteSpace: "normal" }}
                      variant="body2"
                    >
                      {toDisplayValue(value)}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : status === "loading" ? (
          <Typography
            sx={{ overflowWrap: "anywhere", whiteSpace: "normal" }}
            variant="body2"
          >
            Loading...
          </Typography>
        ) : (
          <Typography
            sx={{ overflowWrap: "anywhere", whiteSpace: "normal" }}
            variant="body2"
          >
            N/A
          </Typography>
        )}
      </TableCell>
    </TableRow>
  );
}
