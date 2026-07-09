import { Close, FileCopyOutlined } from "@mui/icons-material";
import {
  Box,
  CircularProgress,
  Drawer,
  IconButton,
  Link,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import React from "react";

import { toLocaleString } from "../../lib/dates";
import { FileCollection, toFileCollectionPage } from "../../lib/file-collections";
import { File } from "../../lib/files";
import { toDisplayValue, toFileSizeDisplay } from "../../lib/formatting";
import { DefaultPageSize, RightDrawerWidth } from "../shared/Layout";

interface Props {
  readonly file?: File;
  readonly onClose: () => void;
  readonly open: boolean;
}

export function FileDetailsDrawer({ file, onClose, open }: Props): JSX.Element {
  const { error, fileCollections, loading } = useFileCollections({
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
              <DetailsRow label="Root File Name" value={file.rootFileName} />
              <DetailsRow label="Size" value={toFileSizeDisplay(file.size)} />
              <DetailsRow
                label="Updated"
                value={toLocaleString(file.uploaded)}
              />
              <FileCollectionIdsRow
                error={error}
                fileCollections={fileCollections}
                loading={loading}
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

function useFileCollections({
  fileId,
  open,
}: {
  readonly fileId?: string;
  readonly open: boolean;
}): {
  readonly error?: string;
  readonly fileCollections: FileCollection[];
  readonly loading: boolean;
} {
  const [fileCollections, setFileCollections] = React.useState<FileCollection[]>(
    []
  );
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string>();

  React.useEffect(() => {
    if (!open || fileId == null) {
      setFileCollections([]);
      setLoading(false);
      setError(undefined);
      return;
    }

    const controller = new AbortController();

    const loadPage = async (nextCursor?: string): Promise<FileCollection[]> => {
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
      return body.cursors?.next == null
        ? page.items
        : [...page.items, ...(await loadPage(body.cursors.next))];
    };

    const load = async () => {
      setFileCollections([]);
      setLoading(true);
      setError(undefined);

      try {
        const collections = await loadPage();

        if (!controller.signal.aborted) {
          setFileCollections(collections);
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

  return { error, fileCollections, loading };
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
  fileCollections,
  loading,
}: {
  readonly error?: string;
  readonly fileCollections: FileCollection[];
  readonly loading: boolean;
}): JSX.Element {
  async function copyId(id: string) {
    await navigator.clipboard.writeText(id);
  }

  return (
    <TableRow>
      <TableCell>
        <Typography variant="subtitle2">File Collections</Typography>
        {loading ? (
          <Box
            sx={{ alignItems: "center", display: "flex", gap: 1, mt: 1 }}
          >
            <CircularProgress size={16} />
            <Typography variant="body2">Loading collections...</Typography>
          </Box>
        ) : error != null ? (
          <Typography
            sx={{ mt: 1, overflowWrap: "anywhere", whiteSpace: "normal" }}
            variant="body2"
          >
            {error}
          </Typography>
        ) : fileCollections.length > 0 ? (
          <Table size="small" sx={{ mt: 1, tableLayout: "fixed" }}>
            <TableBody>
              {fileCollections.map((collection) => (
                <TableRow key={collection.id}>
                  <TableCell sx={{ px: 0, py: 0.75, verticalAlign: "top" }}>
                    <Link
                      href={`/file-collections/${encodeURIComponent(
                        collection.id
                      )}`}
                      underline="hover"
                    >
                      <Typography
                        sx={{ overflowWrap: "anywhere", whiteSpace: "normal" }}
                        variant="body2"
                      >
                        {toDisplayValue(collection.name ?? collection.id)}
                      </Typography>
                    </Link>
                    <Box
                      sx={{
                        alignItems: "center",
                        display: "flex",
                        gap: 1,
                        justifyContent: "space-between",
                        mt: 0.5,
                      }}
                    >
                      <Link
                        href={`/file-collections/${encodeURIComponent(
                          collection.id
                        )}`}
                        underline="hover"
                        sx={{ minWidth: 0 }}
                      >
                        <Typography
                          sx={{
                            color: "text.secondary",
                            fontFamily: "monospace",
                            fontSize: "0.7rem",
                            letterSpacing: "-0.02em",
                            lineHeight: 1.4,
                            overflowWrap: "anywhere",
                            whiteSpace: "normal",
                          }}
                          variant="body2"
                        >
                          {collection.id}
                        </Typography>
                      </Link>
                      <Tooltip title="Copy file collection ID">
                        <IconButton
                          aria-label={`Copy ${collection.id}`}
                          onClick={() => copyId(collection.id)}
                          size="small"
                          sx={{ flexShrink: 0 }}
                        >
                          <FileCopyOutlined fontSize="inherit" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Typography
            sx={{ mt: 1, overflowWrap: "anywhere", whiteSpace: "normal" }}
            variant="body2"
          >
            N/A
          </Typography>
        )}
      </TableCell>
    </TableRow>
  );
}
