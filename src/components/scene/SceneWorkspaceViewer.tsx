/* @jsx jsx */ /** @jsxRuntime classic */ import { jsx } from "@emotion/react";
import { Alert, Box, CircularProgress, Typography } from "@mui/material";
import { VertexViewer } from "@vertexvis/viewer-react";
import React from "react";

import { StreamCredentials } from "../../lib/config";
import { useViewer } from "../../lib/viewer";
import { CommonProps } from "../../lib/with-session";

interface Props extends CommonProps {
  readonly sceneId: string;
}

type PreviewStatus = "loading" | "ready" | "error" | "forbidden";

/**
 * Creates a key only after the authenticated workspace mounts. The key remains
 * in component memory for the Viewer source and is never added to a URL,
 * browser storage, visible copy, or diagnostic output.
 */
export function SceneWorkspaceViewer({
  clientId,
  networkConfig,
  sceneId,
  vertexEnv,
}: Props): JSX.Element {
  const viewerState = useViewer();
  const [credentials, setCredentials] = React.useState<StreamCredentials>();
  const [status, setStatus] = React.useState<PreviewStatus>("loading");

  React.useEffect(() => {
    if (!viewerState.isReady) return;

    const controller = new AbortController();

    async function load(): Promise<void> {
      try {
        const response = await fetch("/api/stream-keys", {
          body: JSON.stringify({ id: sceneId }),
          method: "POST",
          signal: controller.signal,
        });
        if (!response.ok) {
          if (!controller.signal.aborted) {
            setStatus(response.status === 403 ? "forbidden" : "error");
          }
          return;
        }

        const { key } = (await response.json()) as { key?: string };
        if (!key) {
          if (!controller.signal.aborted) setStatus("error");
          return;
        }
        if (!controller.signal.aborted) {
          setCredentials({ clientId, streamKey: key, vertexEnv });
          setStatus("ready");
        }
      } catch (error) {
        if (!controller.signal.aborted) setStatus("error");
      }
    }

    void load();
    return () => controller.abort();
  }, [clientId, sceneId, vertexEnv, viewerState.isReady]);

  if (status === "forbidden") {
    return (
      <Alert severity="info">
        Viewer preview is unavailable for this account. Workspace details remain
        available.
      </Alert>
    );
  }
  if (status === "error") {
    return (
      <Alert severity="warning">
        Viewer preview could not be loaded. Workspace details remain available.
      </Alert>
    );
  }
  if (status !== "ready" || credentials == null || !viewerState.isReady) {
    return (
      <Box
        aria-label="Loading scene preview"
        sx={{
          alignItems: "center",
          display: "flex",
          gap: 1,
          height: 280,
          justifyContent: "center",
        }}
      >
        <CircularProgress size={24} />
        <Typography color="text.secondary" variant="body2">
          Loading interactive preview…
        </Typography>
      </Box>
    );
  }

  const config = JSON.stringify({ network: { ...networkConfig } });
  return (
    <Box
      aria-label="Scene preview viewer"
      data-testid="scene-preview-frame"
      sx={{
        aspectRatio: "16 / 9",
        overflow: "hidden",
        width: "100%",
      }}
    >
      <VertexViewer
        clientId={credentials.clientId}
        config={
          credentials.vertexEnv === "custom" && networkConfig != null
            ? config
            : undefined
        }
        configEnv={
          credentials.vertexEnv !== "custom" ? credentials.vertexEnv : undefined
        }
        css={{ height: "100%", width: "100%" }}
        data-testid="scene-workspace-viewer"
        id={`scene-workspace-viewer-${sceneId}`}
        ref={viewerState.ref}
        src={`urn:vertex:stream-key:${credentials.streamKey}`}
      />
    </Box>
  );
}
