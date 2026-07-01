import { Download } from "@mui/icons-material";
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  CircularProgress,
  Link,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { head } from "@vertexvis/api-client-node";
import { GetServerSidePropsResult } from "next";
import dynamic from "next/dynamic";
import { withIronSession } from "next-iron-session";
import React from "react";

import { FileDetailsDrawer } from "../../components/file/FileDetailsDrawer";
import { FileCollectionMetadataTable } from "../../components/file-collection/FileCollectionMetadataTable";
import { Layout } from "../../components/shared/Layout";
import { isErrorFailure, toErrorRes } from "../../lib/api";
import {
  FileCollection,
  getFileCollectionsApi,
  toFileCollection,
} from "../../lib/file-collections";
import { File } from "../../lib/files";
import { getClientFromSession, makeCall } from "../../lib/vertex-api";
import {
  CommonProps,
  CookieAttributes,
  NextIronRequest,
  serverSidePropsHandler as commonServerSidePropsHandler,
} from "../../lib/with-session";

interface Props {
  readonly fileCollection: FileCollection;
}

interface ExportReadinessRes {
  readonly fileCount: number;
  readonly message?: string;
  readonly ready: boolean;
  readonly status: number;
}

interface FileJobRes {
  readonly archiveFileId?: string;
  readonly data?: {
    readonly attributes?: {
      readonly status?: string;
    };
    readonly id?: string;
  };
  readonly message?: string;
  readonly status: number;
}

interface DownloadUrlRes {
  readonly message?: string;
  readonly status: number;
  readonly url?: string;
}

const FilesTable = dynamic(() => import("../../components/file/FileTable"), {
  ssr: false,
});

type ServerSideProps = CommonProps & Props;

interface ServerSideContext {
  readonly query: {
    readonly fileCollectionId?: string | string[];
  };
  readonly req: NextIronRequest;
}

export default function FileCollectionDetails({
  fileCollection,
}: Props): JSX.Element {
  const [file, setFile] = React.useState<File | undefined>();
  const [readiness, setReadiness] = React.useState<ExportReadinessRes>();
  const [readinessError, setReadinessError] = React.useState<string>();
  const [exportError, setExportError] = React.useState<string>();
  const [downloadUrl, setDownloadUrl] = React.useState<string>();
  const [archiveFileId, setArchiveFileId] = React.useState<string>();
  const [jobId, setJobId] = React.useState<string>();
  const [jobStatus, setJobStatus] = React.useState<
    "idle" | "creating" | "running" | "complete" | "error"
  >("idle");
  const drawerOpen = Boolean(file);
  const filesApiPath = `/api/file-collections/${encodeURIComponent(
    fileCollection.id
  )}/files`;
  const readinessApiPath = `/api/file-collections/${encodeURIComponent(
    fileCollection.id
  )}/export-readiness`;
  const readinessLoading = readiness == null && readinessError == null;
  const exportInFlight = jobStatus === "creating" || jobStatus === "running";
  const disabledReason = readinessError ?? readiness?.message;
  const exportDisabled =
    exportInFlight || readinessLoading || readiness?.ready !== true;

  React.useEffect(() => {
    const controller = new AbortController();

    async function loadReadiness() {
      try {
        setReadinessError(undefined);
        const res = await fetch(readinessApiPath, {
          signal: controller.signal,
        });
        const body = (await res.json()) as ExportReadinessRes;

        if (!res.ok) {
          setReadinessError(
            body.message ?? "Could not check export availability."
          );
          return;
        }

        setReadiness(body);
      } catch (error) {
        if (!controller.signal.aborted) {
          setReadinessError("Could not check export availability.");
        }
      }
    }

    loadReadiness();

    return () => controller.abort();
  }, [readinessApiPath]);

  React.useEffect(() => {
    if (jobId == null || jobStatus !== "running") return;

    const currentJobId = jobId;
    let active = true;
    let timeout: number | undefined;

    async function pollJob() {
      try {
        const res = await fetch(
          `/api/file-jobs/${encodeURIComponent(currentJobId)}`
        );
        const body = (await res.json()) as FileJobRes;

        if (!active) return;

        if (!res.ok) {
          setJobStatus("error");
          setExportError(body.message ?? "Archive job failed.");
          return;
        }

        const status = body.data?.attributes?.status;
        if (status === "complete") {
          setJobStatus("complete");
        } else if (status === "error") {
          setJobStatus("error");
          setExportError("Archive job failed.");
        } else {
          timeout = window.setTimeout(pollJob, 1000);
        }
      } catch {
        if (active) {
          setJobStatus("error");
          setExportError("Archive job failed.");
        }
      }
    }

    timeout = window.setTimeout(pollJob, 1000);

    return () => {
      active = false;
      if (timeout != null) window.clearTimeout(timeout);
    };
  }, [jobId, jobStatus]);

  React.useEffect(() => {
    if (jobStatus !== "complete" || archiveFileId == null || downloadUrl)
      return;

    const currentArchiveFileId = archiveFileId;
    let active = true;

    async function createDownloadUrl() {
      try {
        const res = await fetch(
          `/api/files/${encodeURIComponent(currentArchiveFileId)}/download-url`,
          { method: "POST" }
        );
        const body = (await res.json()) as DownloadUrlRes;

        if (!active) return;

        if (!res.ok || body.url == null) {
          setJobStatus("error");
          setExportError(
            body.message ??
              "Archive completed, but no download URL was created."
          );
          return;
        }

        setDownloadUrl(body.url);
      } catch {
        if (active) {
          setJobStatus("error");
          setExportError("Archive completed, but no download URL was created.");
        }
      }
    }

    createDownloadUrl();

    return () => {
      active = false;
    };
  }, [archiveFileId, downloadUrl, jobStatus]);

  async function handleExport() {
    if (exportDisabled) return;

    setArchiveFileId(undefined);
    setDownloadUrl(undefined);
    setExportError(undefined);
    setJobId(undefined);
    setJobStatus("creating");

    const res = await fetch("/api/file-jobs", {
      body: JSON.stringify({ fileCollectionId: fileCollection.id }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const body = (await res.json()) as FileJobRes;

    if (!res.ok || body.data?.id == null || body.archiveFileId == null) {
      const message = body.message ?? "Could not start archive export.";
      setJobStatus("error");
      setExportError(message);
      setReadiness((current) =>
        res.status === 400
          ? {
              fileCount: current?.fileCount ?? 0,
              message,
              ready: false,
              status: 200,
            }
          : current
      );
      return;
    }

    setArchiveFileId(body.archiveFileId);
    setJobId(body.data.id);
    setJobStatus("running");
  }

  function handleRetry() {
    setArchiveFileId(undefined);
    setDownloadUrl(undefined);
    setExportError(undefined);
    setJobId(undefined);
    setJobStatus("idle");
  }

  return (
    <Layout
      main={
        <Box sx={{ p: 2 }}>
          <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
            <Link href="/file-collections" underline="hover">
              File Collections
            </Link>
            <Typography color="text.primary">
              {fileCollection.name ?? fileCollection.id}
            </Typography>
          </Breadcrumbs>
          <Paper sx={{ p: 2 }}>
            <Box
              sx={{
                alignItems: { sm: "flex-start" },
                display: "flex",
                flexDirection: { xs: "column", sm: "row" },
                gap: 2,
                justifyContent: "space-between",
              }}
            >
              <Box>
                <Typography variant="h5">File Collection Details</Typography>
                <Typography
                  color="text.secondary"
                  sx={{ overflowWrap: "anywhere", whiteSpace: "normal" }}
                  variant="body2"
                >
                  {fileCollection.id}
                </Typography>
              </Box>
              <Stack alignItems={{ sm: "flex-end" }} spacing={1}>
                {downloadUrl ? (
                  <Button
                    component="a"
                    href={downloadUrl}
                    startIcon={<Download />}
                    target="_blank"
                    variant="contained"
                  >
                    Download Archive
                  </Button>
                ) : (
                  <Button
                    disabled={exportDisabled}
                    onClick={handleExport}
                    startIcon={
                      exportInFlight ? (
                        <CircularProgress color="inherit" size={16} />
                      ) : (
                        <Download />
                      )
                    }
                    variant="contained"
                  >
                    {exportInFlight ? "Exporting Archive" : "Export Archive"}
                  </Button>
                )}
                {readinessLoading && (
                  <Typography color="text.secondary" variant="body2">
                    Checking export availability.
                  </Typography>
                )}
                {exportDisabled && !exportInFlight && disabledReason && (
                  <Typography color="text.secondary" variant="body2">
                    {disabledReason}
                  </Typography>
                )}
                {jobStatus === "running" && (
                  <Typography color="text.secondary" variant="body2">
                    Archive job is running.
                  </Typography>
                )}
              </Stack>
            </Box>
            {jobStatus === "complete" && downloadUrl && (
              <Alert severity="success" sx={{ mt: 2 }}>
                Archive is ready to download.
              </Alert>
            )}
            {jobStatus === "error" && (
              <Alert
                action={
                  <Button color="inherit" onClick={handleRetry} size="small">
                    Retry
                  </Button>
                }
                severity="error"
                sx={{ mt: 2 }}
              >
                {exportError ?? "Archive job failed."}
              </Alert>
            )}
            <Box sx={{ mt: 2 }}>
              <FileCollectionMetadataTable fileCollection={fileCollection} />
            </Box>
          </Paper>
          <FilesTable
            activeFileId={file?.id}
            apiPath={filesApiPath}
            emptyOnLoadError={true}
            logLoadError={true}
            onFileSelected={setFile}
            showCreateButton={false}
            showDeleteAction={false}
            showSuppliedIdFilter={false}
          />
        </Box>
      }
      rightDrawer={
        <FileDetailsDrawer
          file={file}
          onClose={() => setFile(undefined)}
          open={drawerOpen}
        />
      }
      rightDrawerOpen={drawerOpen}
    />
  );
}

export const getServerSideProps = withIronSession(
  serverSidePropsHandler,
  CookieAttributes
);

export async function serverSidePropsHandler({
  query,
  req,
}: ServerSideContext): Promise<GetServerSidePropsResult<ServerSideProps>> {
  const authResult = commonServerSidePropsHandler({ req });
  if (!("props" in authResult)) return authResult;

  const fileCollectionId = head(query.fileCollectionId);
  if (fileCollectionId == null) return { notFound: true };

  const api = getFileCollectionsApi(await getClientFromSession(req.session));
  const res = await makeCall(() =>
    api.getFileCollection({ id: fileCollectionId })
  );

  if (isErrorFailure(res)) {
    const error = toErrorRes({ failure: res });
    if (error.status === 400 || error.status === 404) return { notFound: true };

    throw new Error(error.message);
  }

  return {
    props: {
      ...(authResult.props as CommonProps),
      fileCollection: toFileCollection(res.data),
    },
  };
}
