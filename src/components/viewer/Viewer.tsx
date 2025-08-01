/* @jsx jsx */ /** @jsxRuntime classic */ import { jsx } from "@emotion/react";
import {
  CameraAltOutlined,
  FileCopyOutlined,
  RestartAltOutlined,
  SystemUpdateAltOutlined,
  ZoomOutMapOutlined,
} from "@mui/icons-material";
import {
  Alert,
  Autocomplete,
  AutocompleteCloseReason,
  ClickAwayListener,
  ListItem,
  ListItemIcon,
  ListItemText,
  Snackbar,
  TextField,
} from "@mui/material";
import { vertexvis } from "@vertexvis/frame-streaming-protos";
import {
  JSX as ViewerJSX,
  TapEventDetails,
  VertexViewerCustomEvent,
} from "@vertexvis/viewer";
import {
  VertexViewer,
  VertexViewerToolbar,
  VertexViewerViewCube,
} from "@vertexvis/viewer-react";
import { useRouter } from "next/router";
import React from "react";
import { useHotkeys } from "react-hotkeys-hook";

import { StreamCredentials } from "../../lib/config";
import { copySceneViewCamera, fitAll, getCamera } from "../../lib/scene-items";
import { viewerHasSelection, ViewerState } from "../../lib/viewer";
import { NetworkConfig } from "../../lib/with-session";
import { UpdateSceneReq } from "../../pages/api/scenes";
import CreateSceneViewStateDialog from "./CreateSceneViewStateDialog";
import { ViewerContextMenu } from "./ViewerContextMenu";
import { ViewerSpeedDial } from "./ViewerSpeedDial";

interface ViewerProps extends ViewerJSX.VertexViewer {
  readonly credentials: StreamCredentials;
  readonly viewerState: ViewerState;
  readonly viewerId: string;
  readonly networkConfig?: NetworkConfig;
  readonly onViewStateCreated: () => void;
  readonly onViewReset?: () => void;
}

export interface Action {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly onSelect: () => void;
}

type ViewerComponentType = React.ComponentType<
  ViewerProps & React.RefAttributes<HTMLVertexViewerElement>
>;

type HOCViewerProps = React.RefAttributes<HTMLVertexViewerElement>;

interface OnSelectProps extends HOCViewerProps {
  readonly onSelect: (
    detail: TapEventDetails,
    hit?: vertexvis.protobuf.stream.IHit
  ) => Promise<void>;
}

export const AnimationDurationMs = 1500;
export const Viewer = onTap(UnwrappedViewer);

function UnwrappedViewer({
  credentials,
  viewerState,
  viewerId,
  onViewStateCreated,
  onViewReset,
  networkConfig,
  ...props
}: ViewerProps): JSX.Element {
  const ref = React.useRef<HTMLElement>(null);
  const viewer = viewerState.ref;
  const [key, setKey] = React.useState(Date.now());
  const [createViewState, setCreateViewState] = React.useState(false);
  const [toastMsg, setToastMsg] = React.useState<string | undefined>();
  const router = useRouter();

  useHotkeys("s", () => handleShortcutS(), { keyup: true });

  function handleShortcutS() {
    if (ref?.current == null) return;

    ref.current.focus();
  }

  function handleClose() {
    setKey(Date.now());
  }

  async function handleUpdateBaseCamera() {
    const { sceneId } = router.query;
    const parsedSceneId = Array.isArray(sceneId) ? sceneId[0] : sceneId || "";
    const camera = await getCamera({ viewer: viewer.current });

    if (camera) {
      const req: UpdateSceneReq = {
        id: parsedSceneId,
        camera: {
          position: camera.position,
          lookAt: camera.lookAt,
          up: camera.up,
        },
      };

      await fetch("/api/scenes", {
        body: JSON.stringify(req),
        method: "PATCH",
      });

      setToastMsg("Base scene camera updated.");
    }
  }

  const actions: Action[] = [
    {
      icon: <ZoomOutMapOutlined fontSize="small" />,
      label: "Fit All",
      onSelect: () => fitAll({ viewer: viewer.current }),
    },
    {
      icon: <FileCopyOutlined fontSize="small" />,
      label: "Copy camera",
      onSelect: () => copySceneViewCamera({ viewer: viewer.current }),
    },
    {
      icon: <CameraAltOutlined fontSize="small" />,
      label: "Create View State",
      onSelect: () => setCreateViewState(true),
    },
    {
      icon: <SystemUpdateAltOutlined fontSize="small" />,
      label: "Update base scene with current camera",
      onSelect: handleUpdateBaseCamera,
    },
    {
      icon: <RestartAltOutlined fontSize="small" />,
      label: "Reset View",
      onSelect: () => {
        viewerState.actions.reset();
        onViewReset?.();
      },
    },
  ];

  const stringConfig = JSON.stringify({
    network: {
      ...networkConfig,
    },
  });

  return (
    <VertexViewer
      configEnv={
        credentials.vertexEnv !== "custom" ? credentials.vertexEnv : undefined
      }
      config={
        credentials.vertexEnv === "custom" && networkConfig != null
          ? stringConfig
          : undefined
      }
      css={{ height: "100%", width: "100%" }}
      clientId={credentials.clientId}
      depthBuffers="final"
      featureLines={{
        width: 1.0,
        color: { r: 100, g: 100, b: 100 },
      }}
      id={viewerId}
      ref={viewer}
      src={`urn:vertex:stream-key:${credentials.streamKey}`}
      {...props}
    >
      <VertexViewerToolbar placement="top-left">
        <ClickAwayListener onClickAway={handleClose}>
          <Autocomplete<Action>
            key={key}
            onChange={(e, v) => {
              if (v == null) return;

              if (
                e.type === "keydown" &&
                (e as React.KeyboardEvent).key === "Enter"
              ) {
                handleClose();
                v.onSelect();
              }
            }}
            onClose={(_, reason: AutocompleteCloseReason) => {
              if (reason === "escape") handleClose();
            }}
            options={actions}
            size="small"
            renderInput={(params) => (
              <TextField
                inputRef={ref}
                label="Search Viewer controls"
                {...params}
              />
            )}
            renderOption={(props, option) => (
              <ListItem
                {...props}
                onClick={() => {
                  handleClose();
                  option.onSelect();
                }}
              >
                <ListItemIcon>{option.icon}</ListItemIcon>
                <ListItemText>{option.label}</ListItemText>
              </ListItem>
            )}
            sx={{ p: 1, width: 300 }}
          />
        </ClickAwayListener>
      </VertexViewerToolbar>
      <VertexViewerToolbar placement="top-right">
        <VertexViewerViewCube
          animationDuration={AnimationDurationMs}
          viewer={viewer.current ?? undefined}
        />
      </VertexViewerToolbar>
      <VertexViewerToolbar placement="bottom-right">
        <ViewerSpeedDial actions={actions} />
      </VertexViewerToolbar>
      <CreateSceneViewStateDialog
        viewer={viewer}
        open={createViewState}
        onViewStateCreated={() => {
          setCreateViewState(false);
          onViewStateCreated();
        }}
        onClose={() => setCreateViewState(false)}
      />
      <Snackbar
        open={!!toastMsg}
        autoHideDuration={6000}
        onClose={() => setToastMsg(undefined)}
      >
        <Alert onClose={() => setToastMsg(undefined)} severity="success">
          {toastMsg}
        </Alert>
      </Snackbar>
    </VertexViewer>
  );
}

function onTap<P extends ViewerProps>(
  WrappedViewer: ViewerComponentType
): React.FunctionComponent<P & OnSelectProps> {
  return function Component({
    viewerState,
    onSelect,
    ...props
  }: P & OnSelectProps) {
    const [hit, setHit] = React.useState<vertexvis.protobuf.stream.IHit>();

    async function handleTap(e: VertexViewerCustomEvent<TapEventDetails>) {
      if (props.onTap) props.onTap(e);

      if (!e.defaultPrevented) {
        const scene = await viewerState.ref.current?.scene();
        const raycaster = scene?.raycaster();

        if (raycaster != null) {
          const res = await raycaster.hitItems(e.detail.position);
          const hit = (res?.hits ?? [])[0];
          console.debug(hit);
          setHit(hit);
          await onSelect(e.detail, hit);
        }
      }
    }

    return (
      <>
        <WrappedViewer viewerState={viewerState} {...props} onTap={handleTap} />
        <ViewerContextMenu
          hit={hit}
          hasSelection={viewerHasSelection(viewerState.ref)}
          actions={viewerState.actions}
        />
      </>
    );
  };
}
