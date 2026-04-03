import { Close } from "@mui/icons-material";
import {
  Box,
  Drawer,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Typography,
} from "@mui/material";
import prettyBytes from "pretty-bytes";
import React from "react";

import { toLocaleString } from "../../lib/dates";
import { File } from "../../lib/files";
import { RightDrawerWidth } from "../shared/Layout";

interface Props {
  readonly file?: File;
  readonly onClose: () => void;
  readonly open: boolean;
}

export function FileDetailsDrawer({
  file,
  onClose,
  open,
}: Props): JSX.Element {
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
          File Details
        </Typography>
        <IconButton onClick={onClose} sx={{ mr: 2 }}>
          <Close />
        </IconButton>
      </Box>
      {file ? (
        <TableContainer>
          <Table size="small" sx={{ whiteSpace: "nowrap" }}>
            <TableBody>
              <DetailsRow label="Name" value={file.name} />
              <DetailsRow label="Created" value={toLocaleString(file.created)} />
              <DetailsRow label="Status" value={file.status} />
              <DetailsRow
                label="Expires"
                value={toLocaleString(file.expiresAt)}
              />
              <MetadataRow metadata={file.metadata} />
              <DetailsRow label="Root File Name" value={file.rootFileName} />
              <DetailsRow
                label="Size"
                value={formatFileSize(file.size)}
              />
              <DetailsRow label="Updated" value={toLocaleString(file.uploaded)} />
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
          {displayValue(value)}
        </Typography>
      </TableCell>
    </TableRow>
  );
}

function MetadataRow({
  metadata,
}: {
  readonly metadata?: Record<string, string>;
}): JSX.Element {
  const entries = metadata == null ? [] : Object.entries(metadata);

  return (
    <TableRow>
      <TableCell>
        <Typography variant="subtitle2">Metadata</Typography>
        {entries.length > 0 ? (
          <Table size="small">
            <TableBody>
              {entries.map(([key, value]) => (
                <TableRow key={key}>
                  <TableCell sx={{ px: 0 }}>
                    <Typography variant="subtitle2">{key}</Typography>
                  <Typography
                      sx={{ overflowWrap: "anywhere", whiteSpace: "normal" }}
                      variant="body2"
                    >
                      {displayValue(value)}
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
            N/A
          </Typography>
        )}
      </TableCell>
    </TableRow>
  );
}

function displayValue(value?: string): string {
  return value == null || value.trim().length === 0 ? "N/A" : value;
}

function formatFileSize(size?: number): string | undefined {
  if (size == null) return undefined;

  return prettyBytes(size);
}
