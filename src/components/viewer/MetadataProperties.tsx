import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import React from "react";

import { Metadata } from "../../lib/metadata";
import { Title } from "../shared/Title";

export type MetadataStatus = "loading" | "error" | "ready";

interface Props {
  readonly metadata?: Metadata;
  readonly status?: MetadataStatus;
  readonly error?: string;
  readonly diagnostic?: string;
}

export function MetadataProperties({
  metadata,
  status = "ready",
  error,
  diagnostic,
}: Props): JSX.Element {
  if (status === "loading")
    return <StateMessage message="Loading metadata..." />;
  if (status === "error") {
    return <StateMessage message={error ?? "Failed to load metadata."} error />;
  }

  if (metadata == null) return <NoData />;

  const propKeys = Object.keys(metadata.properties);
  if (propKeys.length === 0) return <NoData />;

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
      <TableContainer sx={{ flexGrow: 1 }}>
        <Table sx={{ whiteSpace: "nowrap", tableLayout: "fixed" }} size="small">
          <TableBody>
            {propKeys.map((k) => (
              <TableRow key={k}>
                <TableCell>
                  <Typography variant="subtitle2">{k}</Typography>
                  <Tooltip
                    title={metadata.properties[k]}
                    placement="left"
                    enterDelay={500}
                  >
                    <Typography
                      sx={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      variant="body2"
                    >
                      {metadata.properties[k]}
                    </Typography>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}

function NoData(): JSX.Element {
  return <StateMessage message="No data" />;
}

function StateMessage({
  message,
  error = false,
}: {
  readonly message: string;
  readonly error?: boolean;
}): JSX.Element {
  return (
    <>
      <DrawerTitle />
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexGrow: 1,
        }}
      >
        <Typography
          role={error ? "alert" : undefined}
          sx={{ color: error ? "error.main" : undefined, mx: 2, mb: 2 }}
          variant="body2"
        >
          {message}
        </Typography>
      </Box>
    </>
  );
}

function DrawerTitle(): JSX.Element {
  return (
    <Title
      sx={{
        borderBottom: "1px solid #ccc",
      }}
    >
      Properties
    </Title>
  );
}
