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
} from "@material-ui/core";
import React from "react";
import useSWR from "swr";

import { fetcher } from "../../lib/api";
import { QueuedJob, toQueuedJobPage } from "../../lib/queued-jobs";
import { SkeletonBody } from "../shared/SkeletonBody";

interface QueuedTranslationsTableProps {
  readonly status: string;
  readonly refreshInterval?: number;
  readonly title: string;
  readonly filter?: (arg0: QueuedJob) => boolean;
}

function useRunningTranslations(status: string, refreshInterval: number) {
  return useSWR(`/api/queued-translations?status=${status}`, fetcher, {
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
          p: 2,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Typography variant="h6">{title}</Typography>
        {isValidating && <CircularProgress size={16} />}
      </Box>

      <Table aria-label="simple table">
        <TableHead>
          <TableRow>
            <TableCell>ID</TableCell>
            <TableCell>Created</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {!data && (
            <SkeletonBody
              numCellsPerRow={2}
              numRows={3}
              includeCheckbox={false}
            />
          )}

          {items?.map((row) => (
            <TableRow
              key={row.id}
              sx={{
                "&:last-child td": {
                  borderBottom: 0,
                },
              }}
            >
              <TableCell>{row.id}</TableCell>
              <TableCell>
                {row.created
                  ? new Date(row.created).toLocaleString()
                  : undefined}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
