import { Close } from "@mui/icons-material";
import {
  Box,
  Drawer,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import React from "react";
import useSWR from "swr";

import { isErrorRes } from "../../lib/api";
import { toLocaleString } from "../../lib/dates";
import { PartRevision, toPartRevision } from "../../lib/part-revisions";
import { RightDrawerWidth } from "../shared/Layout";

interface Props {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly partRevision?: PartRevision;
}

type MetadataValue = NonNullable<PartRevision["metadata"]>[string];

interface MetadataEntry {
  readonly key: string;
  readonly value: string;
}

export function PartRevisionDetailsDrawer({
  open,
  onClose,
  partRevision,
}: Props): JSX.Element {
  const { data, error } = useSWR(
    partRevision == null ? null : `/api/part-revisions/${partRevision.id}`
  );
  const fetchedRevision =
    data != null && !isErrorRes(data) ? toPartRevision(data) : undefined;
  const revisionDetails =
    partRevision == null
      ? fetchedRevision
      : fetchedRevision == null
        ? partRevision
        : { ...partRevision, ...fetchedRevision };
  const showMetadataLoading =
    partRevision != null && fetchedRevision?.metadata == null && error == null;

  return (
    <Drawer
      anchor="right"
      open={open}
      sx={{
        flexShrink: 0,
        width: RightDrawerWidth,
        "& .MuiDrawer-paper": { width: RightDrawerWidth },
      }}
      variant="persistent"
    >
      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
        <Typography sx={{ my: 2, mx: 2 }} variant="h5">
          Part Revision Details
        </Typography>
        <IconButton onClick={onClose} sx={{ mr: 2 }}>
          <Close />
        </IconButton>
      </Box>
      {revisionDetails ? (
        <TableContainer>
          <Table size="small" sx={{ whiteSpace: "nowrap" }}>
            <TableBody>
              <DetailsRow label="Name" value={revisionDetails.name} />
              <DetailsRow
                label="Created"
                value={toLocaleString(revisionDetails.created)}
              />
              <DetailsRow label="Supplied ID" value={revisionDetails.suppliedId} />
              <DetailsRow
                label="Supplied Iteration ID"
                value={revisionDetails.suppliedIterationId}
              />
              <MetadataRow
                metadata={revisionDetails.metadata}
                status={
                  error != null
                    ? "error"
                    : showMetadataLoading
                      ? "loading"
                      : "ready"
                }
              />
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <></>
      )}
    </Drawer>
  );
}

function DetailsRow({
  label,
  value,
}: {
  readonly label: string;
  readonly value?: string;
}): JSX.Element {
  return (
    <TableRow>
      <TableCell>
        <Typography variant="subtitle2">{label}</Typography>
        <Typography
          sx={{ overflowWrap: "anywhere", whiteSpace: "normal" }}
          variant="body2"
        >
          {value ?? "N/A"}
        </Typography>
      </TableCell>
    </TableRow>
  );
}

function MetadataRow({
  metadata,
  status,
}: {
  readonly metadata?: PartRevision["metadata"];
  readonly status: "error" | "loading" | "ready";
}): JSX.Element {
  const entries = metadata == null ? [] : normalizeMetadataEntries(metadata);

  return (
    <TableRow>
      <TableCell>
        <Typography variant="subtitle2">Metadata</Typography>
        {status === "loading" ? (
          <Typography
            sx={{ overflowWrap: "anywhere", whiteSpace: "normal" }}
            variant="body2"
          >
            Loading metadata...
          </Typography>
        ) : status === "error" ? (
          <Typography
            sx={{ overflowWrap: "anywhere", whiteSpace: "normal" }}
            variant="body2"
          >
            Failed to load metadata
          </Typography>
        ) : entries.length > 0 ? (
          <Table
            size="small"
            sx={{
              tableLayout: "fixed",
              whiteSpace: "normal",
              width: "100%",
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell sx={{ px: 0, width: "38%" }}>
                  <Typography variant="subtitle2">Key</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="subtitle2">Value</Typography>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.key}>
                  <TableCell
                    sx={{
                      overflowWrap: "anywhere",
                      px: 0,
                      verticalAlign: "top",
                      whiteSpace: "normal",
                      wordBreak: "break-word",
                    }}
                  >
                    <Typography
                      sx={{
                        overflowWrap: "anywhere",
                        whiteSpace: "normal",
                        wordBreak: "break-word",
                      }}
                      variant="body2"
                    >
                      {entry.key}
                    </Typography>
                  </TableCell>
                  <TableCell
                    sx={{
                      overflowWrap: "anywhere",
                      verticalAlign: "top",
                      whiteSpace: "normal",
                      wordBreak: "break-word",
                    }}
                  >
                    <Typography
                      sx={{
                        overflowWrap: "anywhere",
                        whiteSpace: "normal",
                        wordBreak: "break-word",
                      }}
                      variant="body2"
                    >
                      {entry.value}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Typography
            sx={{ overflowWrap: "anywhere", whiteSpace: "normal" }}
            variant="body2"
          >
            No metadata
          </Typography>
        )}
      </TableCell>
    </TableRow>
  );
}

function normalizeMetadataEntries(
  metadata: NonNullable<PartRevision["metadata"]>
): MetadataEntry[] {
  return Object.entries(metadata).map(([key, value]) => ({
    key,
    value: toMetadataValue(value),
  }));
}

function toMetadataValue(value: MetadataValue): string {
  return "value" in value ? String(value.value) : "N/A";
}
