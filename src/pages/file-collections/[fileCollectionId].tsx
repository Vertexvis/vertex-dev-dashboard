import { Download } from "@mui/icons-material";
import {
  Box,
  Breadcrumbs,
  Button,
  CircularProgress,
  Fade,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { head } from "@vertexvis/api-client-node";
import { GetServerSidePropsResult } from "next";
import dynamic from "next/dynamic";
import { withIronSession } from "next-iron-session";
import React from "react";
import { mutate as mutateCache } from "swr";

import { FileDetailsDrawer } from "../../components/file/FileDetailsDrawer";
import { AddFilesToCollectionDialog } from "../../components/file-collection/AddFilesToCollectionDialog";
import { FileCollectionMetadataTable } from "../../components/file-collection/FileCollectionMetadataTable";
import { AppLink } from "../../components/shared/AppLink";
import { Layout } from "../../components/shared/Layout";
import {
  ErrorRes,
  isErrorFailure,
  isErrorRes,
  toErrorRes,
} from "../../lib/api";
import {
  FileCollection,
  GetFileCollectionRes,
  getFileCollectionsApi,
  toFileCollection,
} from "../../lib/file-collections";
import { FileJobRes } from "../../lib/file-jobs";
import { File, FileDownloadUrlRes } from "../../lib/files";
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

interface ExportReadinessState {
  readonly fileCount: number;
  readonly message?: string;
  readonly ready: boolean;
  readonly status: number;
}

type ExportJobStatus = "idle" | "creating" | "running" | "complete" | "error";

const FileCollectionFilesTable = dynamic(
  () => import("../../components/file-collection/FileCollectionFilesTable"),
  {
    ssr: false,
  }
);

type ServerSideProps = CommonProps & Props;

interface ServerSideContext {
  readonly query: {
    readonly fileCollectionId?: string | string[];
  };
  readonly req: NextIronRequest;
}

interface ExportControlsProps {
  readonly archiveFileId?: string;
  readonly disabledReason?: string;
  readonly downloadInFlight: boolean;
  readonly exportDisabled: boolean;
  readonly exportError?: string;
  readonly exportInFlight: boolean;
  readonly jobStatus: ExportJobStatus;
  readonly onDownloadArchive: () => void;
  readonly onExport: () => void;
  readonly onRefreshReadiness: () => void;
  readonly onRetry: () => void;
  readonly archiveReadyMessageVisible: boolean;
  readonly readinessCheckInFlight: boolean;
  readonly readinessLoading: boolean;
}

function ExportControls({
  archiveReadyMessageVisible,
  archiveFileId,
  disabledReason,
  downloadInFlight,
  exportDisabled,
  exportError,
  exportInFlight,
  jobStatus,
  onDownloadArchive,
  onExport,
  onRefreshReadiness,
  onRetry,
  readinessCheckInFlight,
  readinessLoading,
}: ExportControlsProps): JSX.Element {
  return (
    <Stack
      alignItems={{ xs: "flex-start", sm: "flex-end" }}
      spacing={0.75}
      sx={{ flexShrink: 0 }}
    >
      <ExportPrimaryButton
        archiveFileId={archiveFileId}
        downloadInFlight={downloadInFlight}
        exportDisabled={exportDisabled}
        exportInFlight={exportInFlight}
        jobStatus={jobStatus}
        onDownloadArchive={onDownloadArchive}
        onExport={onExport}
      />
      <Box
        sx={{
          alignItems: "flex-start",
          display: "flex",
          justifyContent: { xs: "flex-start", sm: "flex-end" },
          minHeight: 34,
          width: "100%",
        }}
      >
        <ExportStatusMessage
          archiveReadyMessageVisible={archiveReadyMessageVisible}
          archiveFileId={archiveFileId}
          disabledReason={disabledReason}
          exportDisabled={exportDisabled}
          exportError={exportError}
          exportInFlight={exportInFlight}
          jobStatus={jobStatus}
          onRefreshReadiness={onRefreshReadiness}
          onRetry={onRetry}
          readinessCheckInFlight={readinessCheckInFlight}
          readinessLoading={readinessLoading}
        />
      </Box>
    </Stack>
  );
}

interface ExportPrimaryButtonProps {
  readonly archiveFileId?: string;
  readonly downloadInFlight: boolean;
  readonly exportDisabled: boolean;
  readonly exportInFlight: boolean;
  readonly jobStatus: ExportJobStatus;
  readonly onDownloadArchive: () => void;
  readonly onExport: () => void;
}

function ExportPrimaryButton({
  archiveFileId,
  downloadInFlight,
  exportDisabled,
  exportInFlight,
  jobStatus,
  onDownloadArchive,
  onExport,
}: ExportPrimaryButtonProps): JSX.Element {
  if (jobStatus === "complete" && archiveFileId != null) {
    return (
      <Button
        disabled={downloadInFlight}
        onClick={onDownloadArchive}
        startIcon={<Download />}
        variant="contained"
      >
        {downloadInFlight ? "Opening Archive" : "Download Archive"}
      </Button>
    );
  }

  return (
    <Button
      disabled={exportDisabled}
      onClick={onExport}
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
  );
}

interface ExportStatusMessageProps {
  readonly archiveReadyMessageVisible: boolean;
  readonly archiveFileId?: string;
  readonly disabledReason?: string;
  readonly exportDisabled: boolean;
  readonly exportError?: string;
  readonly exportInFlight: boolean;
  readonly jobStatus: ExportJobStatus;
  readonly onRefreshReadiness: () => void;
  readonly onRetry: () => void;
  readonly readinessCheckInFlight: boolean;
  readonly readinessLoading: boolean;
}

function ExportStatusMessage({
  archiveReadyMessageVisible,
  archiveFileId,
  disabledReason,
  exportDisabled,
  exportError,
  exportInFlight,
  jobStatus,
  onRefreshReadiness,
  onRetry,
  readinessCheckInFlight,
  readinessLoading,
}: ExportStatusMessageProps): JSX.Element | null {
  if (exportError != null) {
    return (
      <Stack
        alignItems="center"
        direction="row"
        justifyContent={{ sm: "flex-end" }}
        spacing={1}
        sx={{ maxWidth: 360 }}
      >
        <Typography
          color="error.main"
          sx={{ overflowWrap: "anywhere", textAlign: { sm: "right" } }}
          variant="body2"
        >
          {exportError}
        </Typography>
        {jobStatus === "error" && (
          <Button onClick={onRetry} size="small">
            Retry
          </Button>
        )}
      </Stack>
    );
  }

  if (jobStatus === "complete" && archiveFileId != null) {
    return (
      <Fade in={archiveReadyMessageVisible} timeout={500} unmountOnExit>
        <Typography color="success.main" variant="body2">
          Archive is ready to download.
        </Typography>
      </Fade>
    );
  }

  if (jobStatus === "running") {
    return (
      <Typography color="text.secondary" variant="body2">
        Archive job is running.
      </Typography>
    );
  }

  if (readinessLoading) {
    return (
      <Typography color="text.secondary" variant="body2">
        Checking export availability.
      </Typography>
    );
  }

  if (!exportDisabled || exportInFlight || disabledReason == null) return null;

  return (
    <Stack
      alignItems="center"
      direction="row"
      justifyContent={{ sm: "flex-end" }}
      spacing={1}
      sx={{ maxWidth: 420 }}
    >
      <Typography
        color="text.secondary"
        sx={{ overflowWrap: "anywhere", textAlign: { sm: "right" } }}
        variant="body2"
      >
        {disabledReason}
      </Typography>
      <Button
        disabled={readinessCheckInFlight}
        onClick={onRefreshReadiness}
        size="small"
      >
        {readinessCheckInFlight
          ? "Checking Availability"
          : "Refresh Availability"}
      </Button>
    </Stack>
  );
}

export default function FileCollectionDetails({
  fileCollection,
}: Props): JSX.Element {
  const fileCollectionIdRef = React.useRef(fileCollection.id);
  const [file, setFile] = React.useState<File | undefined>();
  const [addFilesOpen, setAddFilesOpen] = React.useState(false);
  const [membershipVersion, setMembershipVersion] = React.useState(0);
  const [exportStateCollectionId, setExportStateCollectionId] = React.useState(
    fileCollection.id
  );
  const [readiness, setReadiness] = React.useState<ExportReadinessState>();
  const [readinessError, setReadinessError] = React.useState<string>();
  const [readinessRefreshInFlight, setReadinessRefreshInFlight] =
    React.useState(false);
  const [exportError, setExportError] = React.useState<string>();
  const [archiveReadyMessageVisible, setArchiveReadyMessageVisible] =
    React.useState(false);
  const [downloadInFlight, setDownloadInFlight] = React.useState(false);
  const [archiveFileId, setArchiveFileId] = React.useState<string>();
  const [jobId, setJobId] = React.useState<string>();
  const [jobStatus, setJobStatus] = React.useState<ExportJobStatus>("idle");
  const drawerOpen = Boolean(file);
  const filesApiPath = `/api/file-collections/${encodeURIComponent(
    fileCollection.id
  )}/files`;
  const readinessApiPath = `/api/file-collections/${encodeURIComponent(
    fileCollection.id
  )}?includeExportAvailability=true`;
  const exportStateIsCurrent = exportStateCollectionId === fileCollection.id;
  const currentArchiveFileId = exportStateIsCurrent ? archiveFileId : undefined;
  const currentArchiveReadyMessageVisible =
    exportStateIsCurrent && archiveReadyMessageVisible;
  const currentDownloadInFlight = exportStateIsCurrent && downloadInFlight;
  const currentExportError = exportStateIsCurrent ? exportError : undefined;
  const currentJobStatus = exportStateIsCurrent ? jobStatus : "idle";
  const currentReadiness = exportStateIsCurrent ? readiness : undefined;
  const currentReadinessError = exportStateIsCurrent
    ? readinessError
    : undefined;
  const currentReadinessRefreshInFlight =
    exportStateIsCurrent && readinessRefreshInFlight;
  const readinessLoading =
    currentReadiness == null && currentReadinessError == null;
  const exportInFlight =
    currentJobStatus === "creating" || currentJobStatus === "running";
  const readinessCheckInFlight =
    readinessLoading || currentReadinessRefreshInFlight;
  const disabledReason = currentReadinessError ?? currentReadiness?.message;
  const exportDisabled =
    exportInFlight ||
    readinessCheckInFlight ||
    currentReadiness?.ready !== true;

  const loadReadiness = React.useCallback(
    async (signal?: AbortSignal) => {
      const currentFileCollectionId = fileCollection.id;

      try {
        setReadinessError(undefined);
        const res = await fetch(readinessApiPath, { signal });
        const body = (await res.json()) as GetFileCollectionRes | ErrorRes;

        if (fileCollectionIdRef.current !== currentFileCollectionId) return;

        if (!res.ok || "message" in body) {
          setReadiness(undefined);
          setReadinessError(
            ("message" in body ? body.message : undefined) ??
              "Could not check export availability."
          );
          return;
        }

        setReadiness({
          fileCount: body.export?.fileCount ?? 0,
          message: body.export?.disabledReason,
          ready: body.export?.enabled === true,
          status: body.status,
        });
      } catch (error) {
        if (
          !signal?.aborted &&
          fileCollectionIdRef.current === currentFileCollectionId
        ) {
          setReadiness(undefined);
          setReadinessError("Could not check export availability.");
        }
      }
    },
    [fileCollection.id, readinessApiPath]
  );

  React.useEffect(() => {
    fileCollectionIdRef.current = fileCollection.id;
    setFile(undefined);
    setExportStateCollectionId(fileCollection.id);
    setReadiness(undefined);
    setReadinessError(undefined);
    setReadinessRefreshInFlight(false);
    setArchiveReadyMessageVisible(false);
    setExportError(undefined);
    setDownloadInFlight(false);
    setArchiveFileId(undefined);
    setJobId(undefined);
    setJobStatus("idle");
  }, [fileCollection.id]);

  React.useEffect(() => {
    const controller = new AbortController();

    loadReadiness(controller.signal);

    return () => controller.abort();
  }, [loadReadiness]);

  async function handleMembershipChanged() {
    setMembershipVersion((current) => current + 1);
    await Promise.all([
      loadReadiness(),
      mutateCache(
        (key: unknown) =>
          typeof key === "string" &&
          (key.startsWith("/api/file-collections") ||
            key.startsWith("/api/files")),
        undefined,
        { revalidate: true }
      ),
    ]);
  }

  React.useEffect(() => {
    if (
      !exportStateIsCurrent ||
      jobStatus !== "complete" ||
      !archiveReadyMessageVisible
    )
      return;

    const timeout = window.setTimeout(
      () => setArchiveReadyMessageVisible(false),
      6000
    );

    return () => window.clearTimeout(timeout);
  }, [archiveReadyMessageVisible, exportStateIsCurrent, jobStatus]);

  async function handleRefreshReadiness() {
    if (currentReadinessRefreshInFlight || exportInFlight) return;

    setExportStateCollectionId(fileCollection.id);
    setReadinessRefreshInFlight(true);
    try {
      await loadReadiness();
    } finally {
      setReadinessRefreshInFlight(false);
    }
  }

  React.useEffect(() => {
    if (!exportStateIsCurrent || jobId == null || jobStatus !== "running")
      return;

    const currentJobId = jobId;
    let active = true;
    let timeout: number | undefined;

    async function pollJob() {
      try {
        const res = await fetch(
          `/api/file-jobs/${encodeURIComponent(currentJobId)}`
        );
        const body = (await res.json()) as FileJobRes | ErrorRes;

        if (!active) return;

        if (!res.ok || "message" in body) {
          setJobStatus("error");
          setExportError(
            ("message" in body ? body.message : undefined) ??
              "Archive job failed."
          );
          return;
        }

        const status = body.data?.attributes?.status;
        if (status === "complete") {
          setJobStatus("complete");
          setArchiveReadyMessageVisible(true);
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
  }, [exportStateIsCurrent, jobId, jobStatus]);

  async function handleExport() {
    if (exportDisabled) return;

    const currentFileCollectionId = fileCollection.id;
    setExportStateCollectionId(currentFileCollectionId);
    setArchiveFileId(undefined);
    setArchiveReadyMessageVisible(false);
    setDownloadInFlight(false);
    setExportError(undefined);
    setJobId(undefined);
    setJobStatus("creating");

    let res: Response;
    let body: FileJobRes | ErrorRes;
    try {
      res = await fetch("/api/file-jobs", {
        body: JSON.stringify({ fileCollectionId: fileCollection.id }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      body = (await res.json()) as FileJobRes | ErrorRes;
    } catch {
      if (fileCollectionIdRef.current === currentFileCollectionId) {
        setJobStatus("error");
        setExportError("Could not start archive export.");
      }
      return;
    }

    if (fileCollectionIdRef.current !== currentFileCollectionId) return;

    if (
      !res.ok ||
      !("data" in body) ||
      body.data.id == null ||
      body.archiveFileId == null
    ) {
      const message = isErrorRes(body)
        ? body.message
        : "Could not start archive export.";
      setJobStatus("error");
      setExportError(message);
      setReadiness((current) =>
        res.status === 400
          ? {
              fileCount: current?.fileCount ?? 0,
              message,
              ready: false,
              status: body.status,
            }
          : current
      );
      return;
    }

    setArchiveFileId(body.archiveFileId);
    setJobId(body.data.id);
    setJobStatus("running");
  }

  async function handleDownloadArchive() {
    if (currentArchiveFileId == null || currentDownloadInFlight) return;

    const currentFileCollectionId = fileCollection.id;
    setArchiveReadyMessageVisible(false);
    setDownloadInFlight(true);
    setExportError(undefined);

    try {
      const res = await fetch(
        `/api/files/${encodeURIComponent(currentArchiveFileId)}/download-url`,
        { method: "POST" }
      );
      const body = (await res.json()) as FileDownloadUrlRes | ErrorRes;

      if (fileCollectionIdRef.current !== currentFileCollectionId) return;

      if (!res.ok || !("url" in body)) {
        setExportError(
          ("message" in body ? body.message : undefined) ??
            "Could not create a download URL for this archive."
        );
        return;
      }

      const opened = window.open(body.url, "_blank", "noopener");
      if (opened == null) {
        window.location.assign(body.url);
      }
    } catch {
      if (fileCollectionIdRef.current === currentFileCollectionId) {
        setExportError("Could not create a download URL for this archive.");
      }
    } finally {
      if (fileCollectionIdRef.current === currentFileCollectionId) {
        setDownloadInFlight(false);
      }
    }
  }

  function handleRetry() {
    setExportStateCollectionId(fileCollection.id);
    setArchiveFileId(undefined);
    setArchiveReadyMessageVisible(false);
    setDownloadInFlight(false);
    setExportError(undefined);
    setJobId(undefined);
    setJobStatus("idle");
  }

  return (
    <Layout
      main={
        <Box sx={{ p: 2 }}>
          <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
            <AppLink href="/file-collections" underline="hover">
              File Collections
            </AppLink>
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
              <ExportControls
                archiveReadyMessageVisible={currentArchiveReadyMessageVisible}
                archiveFileId={currentArchiveFileId}
                disabledReason={disabledReason}
                downloadInFlight={currentDownloadInFlight}
                exportDisabled={exportDisabled}
                exportError={currentExportError}
                exportInFlight={exportInFlight}
                jobStatus={currentJobStatus}
                onDownloadArchive={handleDownloadArchive}
                onExport={handleExport}
                onRefreshReadiness={handleRefreshReadiness}
                onRetry={handleRetry}
                readinessCheckInFlight={readinessCheckInFlight}
                readinessLoading={readinessLoading}
              />
            </Box>
            <Box sx={{ mt: 2 }}>
              <FileCollectionMetadataTable fileCollection={fileCollection} />
            </Box>
          </Paper>
          <FileCollectionFilesTable
            activeFileId={file?.id}
            apiPath={filesApiPath}
            collectionId={fileCollection.id}
            key={membershipVersion}
            onAddFiles={() => setAddFilesOpen(true)}
            onFileSelected={setFile}
            onMembersChanged={handleMembershipChanged}
          />
          <AddFilesToCollectionDialog
            collectionId={fileCollection.id}
            onClose={() => setAddFilesOpen(false)}
            onMembersAdded={handleMembershipChanged}
            open={addFilesOpen}
          />
        </Box>
      }
      rightDrawer={
        <FileDetailsDrawer
          file={file}
          membershipVersion={membershipVersion}
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
