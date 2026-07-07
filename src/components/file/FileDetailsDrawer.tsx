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
import { toFileCollectionPage } from "../../lib/file-collections";
import { File } from "../../lib/files";
import { toDisplayValue, toFileSizeDisplay } from "../../lib/formatting";
import { DefaultPageSize, RightDrawerWidth } from "../shared/Layout";

interface Props {
  readonly file?: File;
  readonly onClose: () => void;
  readonly open: boolean;
}

export function FileDetailsDrawer({ file, onClose, open }: Props): JSX.Element {
  const { error, fileCollectionIds, loading } = useFileCollectionIds({
    fileId: file?.id,
    open,
  });

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
              <DetailsRow
                label="Created"
                value={toLocaleString(file.created)}
              />
              <DetailsRow label="Status" value={file.status} />
              <DetailsRow
                label="Expires"
                value={toLocaleString(file.expiresAt)}
              />
              <MetadataRow metadata={file.metadata} />
              <FileCollectionIdsRow
                error={error}
                fileCollectionIds={fileCollectionIds}
                loading={loading}
              />
              <DetailsRow label="Root File Name" value={file.rootFileName} />
              <DetailsRow label="Size" value={toFileSizeDisplay(file.size)} />
              <DetailsRow
                label="Updated"
                value={toLocaleString(file.uploaded)}
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

function useFileCollectionIds({
  fileId,
  open,
}: {
  readonly fileId?: string;
  readonly open: boolean;
}): {
  readonly error?: string;
  readonly fileCollectionIds: string[];
  readonly loading: boolean;
} {
  const [fileCollectionIds, setFileCollectionIds] = React.useState<string[]>(
    []
  );
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string>();

  React.useEffect(() => {
    if (!open || fileId == null) {
      setFileCollectionIds([]);
      setLoading(false);
      setError(undefined);
      return;
    }

    const controller = new AbortController();

    const loadPage = async (nextCursor?: string): Promise<string[]> => {
      if (controller.signal.aborted) return [];

      const params = new URLSearchParams({
        pageSize: DefaultPageSize.toString(),
      });
      if (nextCursor != null) params.set("cursor", nextCursor);

      const res = await fetch(
        `/api/files/${encodeURIComponent(
          fileId
        )}/file-collections?${params.toString()}`,
        { signal: controller.signal }
      );
      const body = await res.json();

      if (controller.signal.aborted) return [];

      if (!res.ok) {
        throw new Error(
          (body as { message?: string }).message ??
            "Could not load file collections."
        );
      }

      const page = toFileCollectionPage(body);
      const ids = page.items.map((item) => item.id);
      return body.cursors?.next == null
        ? ids
        : [...ids, ...(await loadPage(body.cursors.next))];
    };

    const load = async () => {
      setFileCollectionIds([]);
      setLoading(true);
      setError(undefined);

      try {
        const ids = await loadPage();

        if (!controller.signal.aborted) {
          setFileCollectionIds(ids);
          setLoading(false);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not load file collections."
          );
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      controller.abort();
    };
  }, [fileId, open]);

  return { error, fileCollectionIds, loading };
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
                <TableCell
                  sx={{
                    px: 0,
                    py: 0.5,
                    width: "40%",
                    pr: 1,
                  }}
                >
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
                  <TableCell
                    sx={{
                      px: 0,
                      py: 0.5,
                      verticalAlign: "top",
                      pr: 1,
                    }}
                  >
                    <Typography
                      sx={{ overflowWrap: "anywhere", whiteSpace: "normal" }}
                      variant="body2"
                    >
                      {toDisplayValue(key)}
                    </Typography>
                  </TableCell>
                  <TableCell
                    sx={{ px: 0, py: 0.5, pl: 1, verticalAlign: "top" }}
                  >
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

function FileCollectionIdsRow({
  error,
  fileCollectionIds,
  loading,
}: {
  readonly error?: string;
  readonly fileCollectionIds: string[];
  readonly loading: boolean;
}): JSX.Element {
  return (
    <TableRow>
      <TableCell>
        <Typography variant="subtitle2">File Collection IDs</Typography>
        {loading ? (
          <Typography
            sx={{ overflowWrap: "anywhere", whiteSpace: "normal" }}
            variant="body2"
          >
            Loading...
          </Typography>
        ) : error != null ? (
          <Typography
            sx={{ overflowWrap: "anywhere", whiteSpace: "normal" }}
            variant="body2"
          >
            {error}
          </Typography>
        ) : fileCollectionIds.length > 0 ? (
          <Box sx={{ mt: 1 }}>
            {fileCollectionIds.map((id) => (
              <Typography
                key={id}
                sx={{ overflowWrap: "anywhere", whiteSpace: "normal" }}
                variant="body2"
              >
                {id}
              </Typography>
            ))}
          </Box>
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
