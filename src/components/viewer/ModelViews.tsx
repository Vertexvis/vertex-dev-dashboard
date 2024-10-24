import {
  Box,
  IconButton,
  ListItemButton,
  Tooltip,
  Typography,
} from "@mui/material";
import * as React from "react";
import { FixedSizeList } from "react-window";

import { Metadata } from "../../lib/metadata";
import { ModelViewsState } from "../../lib/model-views";
import { PmiAnnotations } from "./PmiAnnotations";
import AutoSizer from "react-virtualized-auto-sizer";
import { Title } from "../shared/Title";
import { CloseOutlined } from "@mui/icons-material";

export interface Props {
  readonly metadata?: Metadata;
  readonly modelViews: ModelViewsState;
}

export function ModelViews({ metadata, modelViews }: Props): JSX.Element {
  const { modelViewList, loadedModelViewId, loadedSceneItemId } = modelViews;

  if (
    loadedSceneItemId == null ||
    metadata == null ||
    modelViewList.length === 0
  ) {
    return <NoData />;
  }

  return (
    <>
      <DrawerTitle onClear={() => modelViews.actions.unloadModelView()} />
      <Box sx={{ flexGrow: 1, overflow: "hidden" }}>
        <AutoSizer>
          {({ height, width }) => {
            return (
              <FixedSizeList
                height={height}
                width={width}
                itemSize={38}
                itemCount={modelViewList.length}
                onItemsRendered={(renderState) => {
                  if (
                    renderState.visibleStopIndex ===
                    modelViewList.length - 1
                  ) {
                    modelViews.actions.fetchNextModelViews(loadedSceneItemId);
                  }
                }}
              >
                {({ index, style }) => {
                  const modelView = modelViewList[index];

                  return (
                    <ListItemButton
                      key={index}
                      style={style}
                      onClick={() => {
                        modelViews.actions.loadModelView(
                          loadedSceneItemId,
                          modelView.id
                        );
                      }}
                      alignItems="flex-start"
                      selected={loadedModelViewId === modelView.id}
                    >
                      <Typography variant="subtitle2">
                        {modelView.displayName}
                      </Typography>
                    </ListItemButton>
                  );
                }}
              </FixedSizeList>
            );
          }}
        </AutoSizer>
      </Box>
      <PmiAnnotations modelViews={modelViews} metadata={metadata} />
    </>
  );
}

function NoData(): JSX.Element {
  return (
    <>
      <DrawerTitle />
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexGrow: 1 }}>
        <Typography sx={{ mx: 2, mb: 2 }} variant="body2">
          No data
        </Typography>
      </Box>
    </>
  );
}

function DrawerTitle({ onClear }: { onClear?: VoidFunction }) {
  return (
    <Title
      sx={{
        display: "flex",
        alignItems: "center",
        borderBottom: "1px solid #ccc",
      }}
    >
      Model Views
      <Tooltip title="Clear Model View">
        <IconButton sx={{ marginLeft: "auto" }} size="small" onClick={onClear}>
          <CloseOutlined fontSize="small" />
        </IconButton>
      </Tooltip>
    </Title>
  );
}
