/* @jsx jsx */ /** @jsxRuntime classic */ import { jsx } from "@emotion/react";
import {
  Autocomplete,
  AutocompleteCloseReason,
  ClickAwayListener,
  ListItem,
  ListItemIcon,
  ListItemText,
  TextField,
} from "@material-ui/core";
import {
  CameraAltOutlined,
  FileCopyOutlined,
  ZoomOutMapOutlined,
} from "@material-ui/icons";
import { vertexvis } from "@vertexvis/frame-streaming-protos";
import { TapEventDetails } from "@vertexvis/viewer";
import {
  JSX as ViewerJSX,
  VertexViewer,
  VertexViewerToolbar,
  VertexViewerViewCube,
} from "@vertexvis/viewer-react";
import React from "react";
import { useHotkeys } from "react-hotkeys-hook";

import { StreamCredentials } from "../../lib/config";
import { copySceneViewCamera, fitAll } from "../../lib/scene-items";
import CreateSceneViewStateDialog from "./CreateSceneViewStateDialog";
import { ViewerSpeedDial } from "./ViewerSpeedDial";

interface Option {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly onSelect: () => void;
}

interface ViewerProps extends ViewerJSX.VertexViewer {
  readonly credentials: StreamCredentials;
  readonly viewer: React.MutableRefObject<HTMLVertexViewerElement | null>;
  readonly viewerId: string;
  readonly onViewStateCreated: () => void;
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
  readonly onSelect: (hit?: vertexvis.protobuf.stream.IHit) => Promise<void>;
}

export const AnimationDurationMs = 1500;
export const Viewer = onTap(UnwrappedViewer);

function UnwrappedViewer({
  credentials,
  viewer,
  viewerId,
  onViewStateCreated,
  ...props
}: ViewerProps): JSX.Element {
  const ref = React.useRef<HTMLElement>(null);
  const [key, setKey] = React.useState(Date.now());
  const [createViewState, setCreateViewState] = React.useState(false);

  useHotkeys("s", () => handleShortcutS(), { keyup: true });

  function handleShortcutS() {
    if (ref?.current == null) return;

    ref.current.focus();
  }

  function handleClose() {
    setKey(Date.now());
  }

  const options: Option[] = [
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
  ];

  return (
    <VertexViewer
      configEnv={credentials.vertexEnv}
      css={{ height: "100%", width: "100%" }}
      clientId={credentials.clientId}
      id={viewerId}
      ref={viewer}
      src={`urn:vertexvis:stream-key:${credentials.streamKey}`}
      {...props}
    >
      <VertexViewerToolbar placement="top-left">
        <ClickAwayListener onClickAway={handleClose}>
          <Autocomplete<Option>
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
            options={options}
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
        <ViewerSpeedDial
          viewer={viewer}
          onCreateSceneViewState={() => setCreateViewState(true)}
        />
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
    </VertexViewer>
  );
}

function onTap<P extends ViewerProps>(
  WrappedViewer: ViewerComponentType
): React.FunctionComponent<P & OnSelectProps> {
  return function Component({ viewer, onSelect, ...props }: P & OnSelectProps) {
    async function handleTap(e: CustomEvent<TapEventDetails>) {
      if (props.onTap) props.onTap(e);

      if (!e.defaultPrevented) {
        const scene = await viewer.current?.scene();
        const raycaster = scene?.raycaster();

        if (raycaster != null) {
          const res = await raycaster.hitItems(e.detail.position, {
            includeMetadata: true,
          });
          const hit = (res?.hits ?? [])[0];
          await onSelect(hit);
        }
      }
    }

    return <WrappedViewer viewer={viewer} {...props} onTap={handleTap} />;
  };
}
