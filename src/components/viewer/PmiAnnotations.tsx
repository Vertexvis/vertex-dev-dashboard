import { Box, ListItemButton, Typography } from "@mui/material";
import * as React from "react";
import AutoSizer, { Size } from "react-virtualized-auto-sizer";
import { FixedSizeList } from "react-window";

import { Metadata } from "../../lib/metadata";
import { ModelViewsState } from "../../lib/model-views";
import { Title } from "../shared/Title";

export interface Props {
  readonly metadata?: Metadata;
  readonly modelViews: ModelViewsState;
}

export function PmiAnnotations({ metadata, modelViews }: Props): JSX.Element {
  const { annotationList, loadedModelViewId, loadedSceneItemId } = modelViews;

  if (loadedModelViewId != null && annotationList.length === 0) {
    return <NoData />;
  } else if (
    loadedSceneItemId == null ||
    metadata == null ||
    annotationList.length === 0
  ) {
    return <></>;
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        overflow: "hidden",
      }}
    >
      <Title
        sx={{
          borderTop: "1px solid #ccc",
          borderBottom: "1px solid #ccc",
        }}
      >
        PMI Annotations
      </Title>
      <Box sx={{ flexGrow: 1, overflow: "hidden" }}>
        <AutoSizer>
          {({ height, width }: Size) => {
            return (
              <FixedSizeList
                height={height}
                width={width}
                itemSize={38}
                itemCount={annotationList.length}
                onItemsRendered={(renderState) => {
                  if (
                    loadedModelViewId != null &&
                    renderState.visibleStopIndex === annotationList.length - 1
                  ) {
                    modelViews.actions.fetchNextAnnotations(loadedModelViewId);
                  }
                }}
              >
                {({ index, style }) => {
                  const annotation = annotationList[index];

                  return (
                    <ListItemButton
                      key={index}
                      style={style}
                      alignItems="flex-start"
                    >
                      <Typography variant="subtitle2">
                        {annotation.displayName}
                      </Typography>
                    </ListItemButton>
                  );
                }}
              </FixedSizeList>
            );
          }}
        </AutoSizer>
      </Box>
    </Box>
  );
}

function NoData(): JSX.Element {
  return (
    <Typography sx={{ mx: 2, mb: 2 }} variant="body2">
      No data
    </Typography>
  );
}
