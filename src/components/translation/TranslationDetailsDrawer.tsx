import { Close, FileCopyOutlined } from "@mui/icons-material";
import {
  Box,
  CircularProgress,
  Drawer,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import React from "react";
import useSWR from "swr";

import { isErrorRes } from "../../lib/api";
import { toLocaleString } from "../../lib/dates";
import { toDisplayValue } from "../../lib/formatting";
import { QueuedJob, QueuedTranslationJobRes } from "../../lib/queued-jobs";
import { RightDrawerWidth } from "../shared/Layout";

interface Props {
  readonly job?: QueuedJob;
  readonly onClose: () => void;
  readonly open: boolean;
}

interface AttributeEntry {
  readonly key: string;
  readonly label: string;
  readonly monospace: boolean;
  readonly value: string;
}

interface RelationshipData {
  readonly data?: { readonly id?: string; readonly type?: string };
}

interface IncludedResource {
  readonly id?: string;
  readonly type?: string;
}

const DateAttributeKeys = new Set(["completed", "created"]);
const AttributeKeyOrder = ["status", "created", "completed"];

export function TranslationDetailsDrawer({
  job,
  onClose,
  open,
}: Props): JSX.Element {
  const { data, error } = useSWR(
    job == null
      ? null
      : `/api/queued-translations/${encodeURIComponent(job.id)}`
  );
  const details =
    data != null && !isErrorRes(data)
      ? (data as QueuedTranslationJobRes)
      : undefined;
  const detailsFailed = error != null || (data != null && isErrorRes(data));
  const detailsLoading = job != null && details == null && !detailsFailed;
  const attributes =
    details != null
      ? toRecord(details.data.attributes)
      : job == null
      ? undefined
      : toRecord({
          ...(job.errors == null ? {} : { errors: job.errors }),
          created: job.created,
          status: job.status,
        });
  const links = {
    ...details?.links,
    ...details?.data.links,
  };
  const relationships = Object.entries(
    toRecord<RelationshipData>(details?.data.relationships) ?? {}
  );
  const included: IncludedResource[] = details?.included ?? [];

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
          Translation Job Details
        </Typography>
        <IconButton onClick={onClose} sx={{ mr: 2 }}>
          <Close />
        </IconButton>
      </Box>
      {job ? (
        <TableContainer>
          <Table size="small" sx={{ whiteSpace: "nowrap" }}>
            <TableBody>
              <JobIdRow id={job.id} />
              {details?.data.type != null && (
                <DetailsRow label="Type" value={details.data.type} />
              )}
              {attributes != null &&
                toAttributeEntries(attributes).map((entry) => (
                  <DetailsRow
                    key={entry.key}
                    label={entry.label}
                    monospace={entry.monospace}
                    value={entry.value}
                  />
                ))}
              {relationships.length > 0 && (
                <SectionRow
                  entries={relationships.map(([key, relationship]) => ({
                    key,
                    label: toLabel(key),
                    value: [relationship.data?.type, relationship.data?.id]
                      .filter((part) => part != null)
                      .join(" "),
                  }))}
                  label="Relationships"
                />
              )}
              {Object.keys(links).length > 0 && (
                <SectionRow
                  entries={Object.entries(links).map(([key, link]) => ({
                    key,
                    label: toLabel(key),
                    value: link.href,
                  }))}
                  label="Links"
                />
              )}
              {included.length > 0 && (
                <SectionRow
                  entries={included.map((resource, index) => ({
                    key: `${resource.type}-${resource.id}-${index}`,
                    label: toLabel(resource.type ?? "resource"),
                    value: resource.id ?? "N/A",
                  }))}
                  label="Included"
                />
              )}
              {(detailsLoading || detailsFailed) && (
                <TableRow>
                  <TableCell>
                    {detailsLoading ? (
                      <Box
                        sx={{
                          alignItems: "center",
                          display: "flex",
                          gap: 1,
                        }}
                      >
                        <CircularProgress size={16} />
                        <Typography variant="body2">
                          Loading full job details...
                        </Typography>
                      </Box>
                    ) : (
                      <Typography
                        sx={{ overflowWrap: "anywhere", whiteSpace: "normal" }}
                        variant="body2"
                      >
                        Could not load full job details. Showing summary data.
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <></>
      )}
    </Drawer>
  );
}

function JobIdRow({ id }: { readonly id: string }): JSX.Element {
  async function copyId() {
    await navigator.clipboard.writeText(id);
  }

  return (
    <TableRow>
      <TableCell>
        <Typography variant="subtitle2">ID</Typography>
        <Box
          sx={{
            alignItems: "center",
            display: "flex",
            gap: 1,
            justifyContent: "space-between",
          }}
        >
          <Typography
            sx={{
              fontFamily: "monospace",
              overflowWrap: "anywhere",
              whiteSpace: "normal",
            }}
            variant="body2"
          >
            {id}
          </Typography>
          <Tooltip title="Copy translation job ID">
            <IconButton
              aria-label={`Copy ${id}`}
              onClick={copyId}
              size="small"
              sx={{ flexShrink: 0 }}
            >
              <FileCopyOutlined fontSize="inherit" />
            </IconButton>
          </Tooltip>
        </Box>
      </TableCell>
    </TableRow>
  );
}

function DetailsRow({
  label,
  monospace = false,
  value,
}: {
  readonly label: string;
  readonly monospace?: boolean;
  readonly value?: string;
}): JSX.Element {
  return (
    <TableRow>
      <TableCell>
        <Typography variant="subtitle2">{label}</Typography>
        <Typography
          component={monospace ? "pre" : "p"}
          sx={{
            m: 0,
            overflowWrap: "anywhere",
            whiteSpace: monospace ? "pre-wrap" : "normal",
            ...(monospace && { fontFamily: "monospace", fontSize: "0.75rem" }),
          }}
          variant="body2"
        >
          {toDisplayValue(value)}
        </Typography>
      </TableCell>
    </TableRow>
  );
}

function SectionRow({
  entries,
  label,
}: {
  readonly entries: readonly {
    readonly key: string;
    readonly label: string;
    readonly value: string;
  }[];
  readonly label: string;
}): JSX.Element {
  return (
    <TableRow>
      <TableCell>
        <Typography variant="subtitle2">{label}</Typography>
        {entries.map((entry) => (
          <Box key={entry.key} sx={{ mt: 0.5 }}>
            <Typography
              sx={{ color: "text.secondary" }}
              variant="caption"
            >
              {entry.label}
            </Typography>
            <Typography
              sx={{
                fontFamily: "monospace",
                fontSize: "0.75rem",
                overflowWrap: "anywhere",
                whiteSpace: "normal",
              }}
              variant="body2"
            >
              {toDisplayValue(entry.value)}
            </Typography>
          </Box>
        ))}
      </TableCell>
    </TableRow>
  );
}

function toRecord<T = unknown>(value?: unknown): Record<string, T> | undefined {
  return value == null ? undefined : (value as Record<string, T>);
}

function toAttributeEntries(
  attributes: Record<string, unknown>
): readonly AttributeEntry[] {
  return Object.entries(attributes)
    .sort(([leftKey], [rightKey]) => {
      const leftIndex = AttributeKeyOrder.indexOf(leftKey);
      const rightIndex = AttributeKeyOrder.indexOf(rightKey);

      if (leftIndex === -1 && rightIndex === -1)
        return leftKey.localeCompare(rightKey);
      if (leftIndex === -1) return 1;
      if (rightIndex === -1) return -1;
      return leftIndex - rightIndex;
    })
    .map(([key, value]) => ({
      key,
      label: toLabel(key),
      ...toValueDisplay(key, value),
    }));
}

function toValueDisplay(
  key: string,
  value: unknown
): { readonly monospace: boolean; readonly value: string } {
  if (value == null) return { monospace: false, value: "N/A" };

  if (typeof value === "string") {
    return {
      monospace: false,
      value: DateAttributeKeys.has(key) ? toLocaleString(value) : value,
    };
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return { monospace: false, value: String(value) };
  }

  return { monospace: true, value: JSON.stringify(value, null, 2) };
}

function toLabel(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
