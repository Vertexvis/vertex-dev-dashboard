import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import {
  SceneData,
  SceneItemData,
  SceneViewData,
} from "@vertexvis/api-client-node";
import NextLink from "next/link";
import React from "react";
import useSWR from "swr";

import { ErrorRes, GetRes, isErrorRes } from "../../lib/api";
import { CommonProps } from "../../lib/with-session";
import { SceneExports } from "../artifacts/SceneExports";
import { SceneWorkspaceViewer } from "./SceneWorkspaceViewer";

type WorkspaceTab =
  | "overview"
  | "assembly"
  | "views"
  | "exports"
  | "inspect"
  | "changes";

interface Props extends CommonProps {
  readonly sceneId: string;
}

function statusError(data: unknown) {
  const response = data as {
    readonly message?: string;
    readonly status?: number;
  };
  return isErrorRes(response) ? response.message : undefined;
}

function Loading(): JSX.Element {
  return (
    <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
      <CircularProgress aria-label="Loading" size={24} />
    </Box>
  );
}

function Empty({
  children,
}: {
  readonly children: React.ReactNode;
}): JSX.Element {
  return <Typography color="text.secondary">{children}</Typography>;
}

function ApiError({ message }: { readonly message: string }): JSX.Element {
  return <Alert severity="error">{message}</Alert>;
}

export function SceneWorkspace({
  clientId,
  networkConfig,
  sceneId,
  vertexEnv,
}: Props): JSX.Element {
  const [tab, setTab] = React.useState<WorkspaceTab>("overview");
  const [selectedViewId, setSelectedViewId] = React.useState<string>();
  const scene = useSWR<SceneData, ErrorRes>(`/api/scenes/${sceneId}`);
  const items = useSWR<GetRes<SceneItemData>, ErrorRes>(
    tab === "assembly"
      ? `/api/scene-workspace-items?sceneId=${encodeURIComponent(sceneId)}`
      : null
  );
  const views = useSWR<GetRes<SceneViewData>, ErrorRes>(
    tab === "views"
      ? `/api/scene-workspace-views?sceneId=${encodeURIComponent(sceneId)}`
      : null
  );

  const sceneError = scene.error?.message ?? statusError(scene.data);
  const itemError = items.error?.message ?? statusError(items.data);
  const viewError = views.error?.message ?? statusError(views.data);
  const attributes = scene.data?.attributes;

  return (
    <Box sx={{ mx: "auto", maxWidth: 1200, p: 3 }}>
      <Box
        sx={{
          alignItems: { md: "center", xs: "flex-start" },
          display: "flex",
          flexDirection: { md: "row", xs: "column" },
          gap: 2,
          justifyContent: "space-between",
          mb: 2,
        }}
      >
        <Box>
          <Typography component="h1" variant="h5">
            Scene Workspace
          </Typography>
          <Typography color="text.secondary" variant="body2">
            {attributes?.name ?? "Loading scene…"}
          </Typography>
          <Typography color="text.secondary" variant="caption">
            Scene ID: {sceneId}
          </Typography>
        </Box>
        <Button component={NextLink} href="/" variant="outlined">
          Back to scenes
        </Button>
      </Box>

      <Paper sx={{ mb: 2, p: 2 }}>
        <Typography component="h2" sx={{ mb: 1 }} variant="h6">
          Interactive preview
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }} variant="body2">
          A compact, session-authenticated preview. It does not change the
          existing full Viewer route or shareable Viewer URL behavior.
        </Typography>
        <SceneWorkspaceViewer
          clientId={clientId}
          networkConfig={networkConfig}
          sceneId={sceneId}
          vertexEnv={vertexEnv}
        />
      </Paper>

      <Paper>
        <Tabs
          aria-label="Scene workspace sections"
          onChange={(_, nextTab: WorkspaceTab) => setTab(nextTab)}
          value={tab}
          variant="scrollable"
        >
          <Tab label="Overview" value="overview" />
          <Tab label="Assembly" value="assembly" />
          <Tab label="Views & states" value="views" />
          <Tab label="Exports" value="exports" />
          <Tab label="Inspect" value="inspect" />
          <Tab label="Changes & delivery" value="changes" />
        </Tabs>
        <Divider />
        <Box sx={{ p: 3 }}>
          {tab === "overview" && (
            <section aria-label="Scene overview">
              {sceneError ? (
                <ApiError message={sceneError} />
              ) : !scene.data ? (
                <Loading />
              ) : (
                <Box sx={{ display: "grid", gap: 1 }}>
                  <Typography>
                    <strong>State:</strong>{" "}
                    {attributes?.state ?? "Not provided"}
                  </Typography>
                  <Typography>
                    <strong>Supplied ID:</strong>{" "}
                    {attributes?.suppliedId ?? "Not provided"}
                  </Typography>
                  <Typography>
                    <strong>Scene items:</strong>{" "}
                    {attributes?.sceneItemCount ?? "Not provided"}
                  </Typography>
                  <Typography>
                    <strong>Last modified:</strong>{" "}
                    {attributes?.modified ?? "Not provided"}
                  </Typography>
                  <Typography color="text.secondary" variant="body2">
                    This additive workspace is read-only. Existing scene
                    editing, stream-key generation, and Viewer behavior remain
                    unchanged.
                  </Typography>
                </Box>
              )}
            </section>
          )}

          {tab === "assembly" && (
            <section aria-label="Scene assembly">
              <Typography component="h2" sx={{ mb: 2 }} variant="h6">
                Scene items
              </Typography>
              {itemError ? (
                <ApiError message={itemError} />
              ) : !items.data ? (
                <Loading />
              ) : items.data.data.length === 0 ? (
                <Empty>This scene has no scene items.</Empty>
              ) : (
                <List aria-label="Scene items" disablePadding>
                  {items.data.data.map((item) => (
                    <ListItemButton key={item.id} divider>
                      <ListItemText
                        primary={item.attributes.name ?? item.id}
                        secondary={`ID: ${item.id}${
                          item.attributes.suppliedId
                            ? ` · Supplied ID: ${item.attributes.suppliedId}`
                            : ""
                        }`}
                      />
                    </ListItemButton>
                  ))}
                </List>
              )}
            </section>
          )}

          {tab === "views" && (
            <section aria-label="Scene views and states">
              <Typography component="h2" sx={{ mb: 2 }} variant="h6">
                Scene views
              </Typography>
              {viewError ? (
                <ApiError message={viewError} />
              ) : !views.data ? (
                <Loading />
              ) : views.data.data.length === 0 ? (
                <Empty>This scene has no scene views.</Empty>
              ) : (
                <List aria-label="Scene views" disablePadding>
                  {views.data.data.map((view) => (
                    <ListItemButton
                      aria-pressed={selectedViewId === view.id}
                      key={view.id}
                      onClick={() => setSelectedViewId(view.id)}
                      selected={selectedViewId === view.id}
                    >
                      <ListItemText
                        primary={view.id}
                        secondary={`Created: ${view.attributes.created}`}
                      />
                    </ListItemButton>
                  ))}
                </List>
              )}

              <Box sx={{ mt: 3 }}>
                <Typography component="h3" sx={{ mb: 1 }} variant="subtitle1">
                  Scene saved states
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  Vertex lists saved states for a scene, not for a selected
                  scene view. This workspace intentionally defers that
                  scene-wide list and its actions until a verified association
                  contract is available. Applying or creating a state continues
                  to happen in the established Viewer.
                </Typography>
              </Box>
            </section>
          )}

          {tab === "exports" && <SceneExports sceneId={sceneId} />}

          {tab === "inspect" && (
            <section aria-label="Scene inspection">
              <Typography component="h2" variant="h6">
                Viewer-led inspection
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                Platform hits need coordinates and viewport dimensions from an
                active Viewer. The existing Viewer retains that interaction;
                this workspace deliberately does not accept manually entered
                coordinates.
              </Typography>
            </section>
          )}

          {tab === "changes" && (
            <section aria-label="Scene changes and delivery">
              <Typography component="h2" variant="h6">
                Changes & delivery
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                Alterations, annotations, overrides, synchronizations, and
                batches are deferred until their typed request contracts,
                permissions, previews, and asynchronous status handling are
                independently validated.
              </Typography>
            </section>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
