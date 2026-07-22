import { PictureAsPdf } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Drawer,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { DocumentData, FileList } from "@vertexvis/api-client-node";
import React from "react";
import useSWR from "swr";

import { ErrorRes, GetRes, isErrorRes } from "../../lib/api";
import { requestJson } from "../../lib/api/client";
import { isCompleteFileStatus } from "../../lib/files";
import { ResourceLink } from "../shared/ResourceLink";

function message(value: unknown): string | undefined {
  return isErrorRes(value as ErrorRes)
    ? (value as ErrorRes).message
    : undefined;
}

function fileViewHref(fileId: string): string {
  return `/files?fileId=${encodeURIComponent(fileId)}`;
}

function DocumentTypeIcon({ type }: { readonly type: string }): JSX.Element {
  if (type.toLowerCase() === "pdf") {
    return (
      <Tooltip title="PDF">
        <Box
          aria-label="PDF document"
          role="img"
          sx={{ display: "inline-flex" }}
        >
          <PictureAsPdf color="error" fontSize="small" />
        </Box>
      </Tooltip>
    );
  }

  return (
    <Typography component="span" variant="body2">
      {type.toUpperCase()}
    </Typography>
  );
}

type FileDisplay = "id" | "name";

export function DocumentsPage(): JSX.Element {
  const [suppliedId, setSuppliedId] = React.useState("");
  const [filter, setFilter] = React.useState("");
  const [cursor, setCursor] = React.useState<string>();
  const [fileId, setFileId] = React.useState("");
  const [selectedDocumentId, setSelectedDocumentId] = React.useState<string>();
  const [newSuppliedId, setNewSuppliedId] = React.useState("");
  const [fileDisplay, setFileDisplay] = React.useState<FileDisplay>("name");
  const [error, setError] = React.useState<string>();
  const [creating, setCreating] = React.useState(false);
  const documentPath = `/api/documents?pageSize=25${
    cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""
  }${filter ? `&suppliedId=${encodeURIComponent(filter)}` : ""}`;
  const documents = useSWR<GetRes<DocumentData> | ErrorRes>(documentPath);
  const selectedDocument = useSWR<DocumentData | ErrorRes>(
    selectedDocumentId
      ? `/api/documents/${encodeURIComponent(selectedDocumentId)}`
      : null
  );
  const files = useSWR<GetRes<FileList["data"][number]> | ErrorRes>(
    "/api/files?pageSize=100"
  );
  const listError = documents.error?.message ?? message(documents.data);
  const filesError = files.error?.message ?? message(files.data);
  const documentError = documents.data as ErrorRes | undefined;
  const previewUnavailable =
    isErrorRes(documentError) && documentError.status === 403;
  const documentPage =
    documents.data && !isErrorRes(documents.data) ? documents.data : undefined;
  const selectedDocumentData: DocumentData | undefined =
    selectedDocument.data && !isErrorRes(selectedDocument.data as ErrorRes)
      ? (selectedDocument.data as DocumentData)
      : undefined;
  const completedFiles =
    files.data && !isErrorRes(files.data)
      ? files.data.data.filter((file) =>
          isCompleteFileStatus(file.attributes.status)
        )
      : [];
  const fileNamesById = React.useMemo(
    () =>
      new Map(
        files.data && !isErrorRes(files.data)
          ? files.data.data.map((file) => [file.id, file.attributes.name])
          : []
      ),
    [files.data]
  );

  function fileLabel(fileId: string): string {
    const fileName = fileNamesById.get(fileId);
    return fileDisplay === "name" && fileName ? fileName : fileId;
  }

  async function create(): Promise<void> {
    if (!fileId) {
      setError("Choose a completed file.");
      return;
    }
    setCreating(true);
    setError(undefined);
    try {
      const result = await requestJson<DocumentData | ErrorRes>(
        "/api/documents",
        {
          body: JSON.stringify({
            fileId,
            suppliedId: newSuppliedId || undefined,
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        }
      );
      if (isErrorRes(result as ErrorRes)) {
        setError((result as ErrorRes).message);
      } else {
        setNewSuppliedId("");
        void documents.mutate();
      }
    } catch {
      setError("Unable to register document.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Box sx={{ mx: "auto", maxWidth: 1200, p: 3 }}>
      <Typography component="h1" variant="h5">
        Documents{" "}
        <Typography component="span" color="warning.main" variant="caption">
          PREVIEW
        </Typography>
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }} variant="body2">
        Register and inspect file-backed documents. This Preview API supports
        list, create, and detail only; it does not upload, update, delete, or
        download documents.
      </Typography>
      <Paper sx={{ mb: 3, p: 3 }}>
        <Typography component="h2" variant="h6">
          Register document
        </Typography>
        {filesError ? (
          <Alert severity="warning" sx={{ mt: 2 }}>
            Files are unavailable: {filesError}
          </Alert>
        ) : (
          <Box sx={{ display: "grid", gap: 2, maxWidth: 520, mt: 2 }}>
            <TextField
              label="Completed source file"
              onChange={(event) => setFileId(event.target.value)}
              select
              value={fileId}
            >
              {completedFiles.map((file) => (
                <MenuItem key={file.id} value={file.id}>
                  {file.attributes.name ?? file.id}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Supplied ID (optional)"
              onChange={(event) => setNewSuppliedId(event.target.value)}
              value={newSuppliedId}
            />
            <Box>
              <Button
                disabled={
                  previewUnavailable || creating || completedFiles.length === 0
                }
                onClick={() => void create()}
                variant="contained"
              >
                {creating ? "Registering…" : "Register document"}
              </Button>
            </Box>
          </Box>
        )}
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </Paper>
      <Paper sx={{ p: 3 }}>
        <Box
          sx={{
            alignItems: "center",
            display: "flex",
            gap: 1,
            justifyContent: "space-between",
            mb: 2,
          }}
        >
          <Typography component="h2" variant="h6">
            Documents
          </Typography>
          <Box sx={{ alignItems: "center", display: "flex", gap: 1 }}>
            <ToggleButtonGroup
              aria-label="File display"
              exclusive
              onChange={(_, value: FileDisplay | null) => {
                if (value != null) setFileDisplay(value);
              }}
              size="small"
              value={fileDisplay}
            >
              <ToggleButton aria-label="Display filenames" value="name">
                Filename
              </ToggleButton>
              <ToggleButton aria-label="Display File IDs" value="id">
                File ID
              </ToggleButton>
            </ToggleButtonGroup>
            <TextField
              label="Supplied ID filter"
              onChange={(event) => setSuppliedId(event.target.value)}
              size="small"
              value={suppliedId}
            />
            <Button
              onClick={() => {
                setCursor(undefined);
                setFilter(suppliedId.trim());
              }}
            >
              Apply
            </Button>
          </Box>
        </Box>
        {listError ? (
          <Alert severity={previewUnavailable ? "warning" : "error"}>
            {previewUnavailable
              ? "Document Preview is unavailable for this account. Registration is read-only until the capability is enabled."
              : `Document Preview is unavailable: ${listError}`}
          </Alert>
        ) : !documents.data ? (
          <CircularProgress aria-label="Loading documents" size={24} />
        ) : isErrorRes(documents.data) ? (
          <Alert severity="error">{documents.data.message}</Alert>
        ) : documents.data.data.length === 0 ? (
          <Typography color="text.secondary">No documents found.</Typography>
        ) : (
          <Table aria-label="Documents">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>File</TableCell>
                <TableCell>Supplied ID</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Created</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {documents.data.data.map((document) => (
                <TableRow key={document.id} hover>
                  <TableCell>
                    <Button
                      onClick={() => setSelectedDocumentId(document.id)}
                      size="small"
                    >
                      {document.id}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <ResourceLink
                      href={fileViewHref(document.attributes.fileId)}
                      primaryActionLabel={`Open file ${document.attributes.fileId}`}
                    >
                      {fileLabel(document.attributes.fileId)}
                    </ResourceLink>
                  </TableCell>
                  <TableCell>{document.attributes.suppliedId ?? "—"}</TableCell>
                  <TableCell>
                    <DocumentTypeIcon type={document.attributes.documentType} />
                  </TableCell>
                  <TableCell>{document.attributes.createdAt}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {documentPage?.cursors.next && (
          <Button onClick={() => setCursor(documentPage.cursors.next)}>
            Next page
          </Button>
        )}
        {cursor && (
          <Button onClick={() => setCursor(undefined)}>First page</Button>
        )}
      </Paper>
      <Drawer
        anchor="right"
        onClose={() => setSelectedDocumentId(undefined)}
        open={selectedDocumentId != null}
      >
        <Box sx={{ p: 3, width: 360 }}>
          <Typography component="h2" variant="h6">
            Document details
          </Typography>
          {!selectedDocument.data ? (
            <CircularProgress aria-label="Loading document details" size={24} />
          ) : isErrorRes(selectedDocument.data as ErrorRes) ? (
            <Alert severity="error">
              {(selectedDocument.data as ErrorRes).message}
            </Alert>
          ) : (
            <Box sx={{ display: "grid", gap: 1, mt: 2 }}>
              <Typography>ID: {selectedDocumentData?.id}</Typography>
              <Typography>
                File:{" "}
                <ResourceLink
                  href={fileViewHref(
                    selectedDocumentData?.attributes.fileId ?? ""
                  )}
                  primaryActionLabel={`Open file ${selectedDocumentData?.attributes.fileId}`}
                >
                  {selectedDocumentData?.attributes.fileId}
                </ResourceLink>
              </Typography>
              <Typography>
                Type: {selectedDocumentData?.attributes.documentType}
              </Typography>
              <Typography>
                Created: {selectedDocumentData?.attributes.createdAt}
              </Typography>
            </Box>
          )}
          <Button
            onClick={() => setSelectedDocumentId(undefined)}
            sx={{ mt: 2 }}
          >
            Close
          </Button>
        </Box>
      </Drawer>
    </Box>
  );
}
