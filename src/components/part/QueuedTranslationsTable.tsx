import {
  Box,
  CircularProgress,
  Paper,
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

import { toLocaleString } from "../../lib/dates";
import { QueuedJob, toQueuedJobPage } from "../../lib/queued-jobs";
import { SkeletonBody } from "../shared/SkeletonBody";

interface QueuedTranslationsTableProps {
  readonly status: string;
  readonly refreshInterval?: number;
  readonly title: string;
  readonly filter?: (arg0: QueuedJob) => boolean;
}

function useRunningTranslations(status: string, refreshInterval: number) {
  return useSWR(`/api/queued-translations?status=${status}`, {
    refreshInterval,
  });
}

export function QueuedTranslationsTable({
  title,
  refreshInterval,
  status,
  filter,
}: QueuedTranslationsTableProps): JSX.Element {
  const { data, isValidating } = useRunningTranslations(
    status,
    refreshInterval || 0
  );
  const page = data ? toQueuedJobPage(data) : undefined;
  const items = filter ? page?.items.filter(filter) : page?.items;

  return (
    <TableContainer sx={{ m: 2 }} component={Paper}>
      <Box
        sx={{
          alignItems: "center",
          display: "flex",
          justifyContent: "space-between",
          p: 2,
        }}
      >
        <Typography variant="h6">{title}</Typography>
        {isValidating && <CircularProgress size={16} />}
      </Box>

      <Table>
        <TableHead>
          <TableRow>
            <TableCell>ID</TableCell>
            <TableCell>Created</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {!data ? (
            <SkeletonBody
              includeCheckbox={false}
              numCellsPerRow={2}
              numRows={5}
              rowHeight={53}
            />
          ) : items && items.length > 0 ? (
            items.map((row) => (
              <TableRow
                key={row.id}
                sx={{ "&:last-child td": { borderBottom: 0 } }}
              >
                <TableCell>{row.id}</TableCell>
                <TableCell>{toLocaleString(row.created)}</TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={2}>No data</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
