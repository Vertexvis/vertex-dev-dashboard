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

import { toLocaleString } from "../../lib/dates";
import { FileCollection } from "../../lib/file-collections";
import { toDisplayValue } from "../../lib/formatting";
import { RightDrawerWidth } from "../shared/Layout";

interface Props {
  readonly fileCollection?: FileCollection;
  readonly onClose: () => void;
  readonly open: boolean;
}

export function FileCollectionDetailsDrawer({
  fileCollection,
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
          File Collection Details
        </Typography>
        <IconButton onClick={onClose} sx={{ mr: 2 }}>
          <Close />
        </IconButton>
      </Box>
      {fileCollection ? (
        <TableContainer>
          <Table size="small" sx={{ whiteSpace: "nowrap" }}>
            <TableBody>
              <DetailsRow label="Name" value={fileCollection.name} />
              <DetailsRow label="ID" value={fileCollection.id} />
              <DetailsRow
                label="Supplied ID"
                value={fileCollection.suppliedId}
              />
              <DetailsRow
                label="Created"
                value={toLocaleString(fileCollection.created)}
              />
              <DetailsRow
                label="Expires"
                value={toLocaleString(fileCollection.expiresAt)}
              />
              <MetadataRow metadata={fileCollection.metadata} />
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
          {toDisplayValue(value)}
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
