import { Alert, Box, Typography } from "@mui/material";
import React from "react";

interface Props {
  readonly sceneId: string;
  readonly selectedSceneViewStateId?: string;
}

/**
 * A visible, safe boundary for an API whose format/config registry has not yet
 * been published by the Platform reference. No request is made from this tab.
 */
export function SceneExports({
  sceneId,
  selectedSceneViewStateId,
}: Props): JSX.Element {
  return (
    <section aria-label="Scene exports">
      <Typography component="h2" variant="h6">
        Exports
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }} variant="body2">
        Scene exports are available through the Platform API, but creation is
        temporarily disabled in this dashboard until an approved export format
        and option profile is available.
      </Typography>
      <Box sx={{ display: "grid", gap: 1, maxWidth: 640 }}>
        <Typography variant="body2">Source scene: {sceneId}</Typography>
        {selectedSceneViewStateId && (
          <Typography variant="body2">
            Selected saved state: {selectedSceneViewStateId}
          </Typography>
        )}
        <Alert severity="info">
          Export creation is feature-gated. No export request or download URL is
          generated from this page.
        </Alert>
      </Box>
    </section>
  );
}
