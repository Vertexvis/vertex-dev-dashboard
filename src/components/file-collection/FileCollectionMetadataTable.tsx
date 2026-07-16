import { Box, Typography } from "@mui/material";

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
  const details = [
    { label: "Name", value: fileCollection.name },
    { label: "ID", value: fileCollection.id },
    { label: "Supplied ID", value: fileCollection.suppliedId },
    { label: "Created", value: toLocaleString(fileCollection.created) },
    {
      label: "Expires",
      status: optionalFieldStatus,
      value: toLocaleString(fileCollection.expiresAt),
    },
  ];
  const metadata = Object.entries(fileCollection.metadata ?? {});

  return (
    <Box sx={{ whiteSpace: "nowrap" }}>
      {details.map(({ label, status, value }) => (
        <Box key={label} sx={{ py: 2 }}>
          <Typography variant="subtitle2">{label}</Typography>
          <Typography
            sx={{ overflowWrap: "anywhere", whiteSpace: "normal" }}
            variant="body2"
          >
            {status === "loading" && value == null
              ? "Loading..."
              : toDisplayValue(value)}
          </Typography>
        </Box>
      ))}
      <Box sx={{ py: 2 }}>
        <Typography variant="subtitle2">Metadata</Typography>
        {metadata.length > 0 ? (
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
            {metadata.flatMap(([key, value]) => [
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
            {optionalFieldStatus === "loading" ? "Loading..." : "N/A"}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
