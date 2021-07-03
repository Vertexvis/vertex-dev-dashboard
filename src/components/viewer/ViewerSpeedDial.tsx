import { SpeedDial, SpeedDialAction } from "@material-ui/core";
import { FileCopyOutlined, ZoomOutMapOutlined } from "@material-ui/icons";

import { copySceneViewCamera, fitAll } from "../../lib/scene-items";
import { Action } from "./Viewer";

interface Props {
  readonly viewer: React.MutableRefObject<HTMLVertexViewerElement | null>;
}

export function ViewerSpeedDial({ viewer }: Props): JSX.Element {
  const actions: Action[] = [
    {
      icon: <ZoomOutMapOutlined />,
      label: "Fit all",
      onSelect: () => fitAll({ viewer: viewer.current }),
    },
    {
      icon: <FileCopyOutlined />,
      label: "Copy camera",
      onSelect: () => copySceneViewCamera({ viewer: viewer.current }),
    },
  ];

  return (
    <SpeedDial
      ariaLabel="Viewer toolbar"
      hidden={true}
      open={true}
      sx={{ mr: 3, mb: 2 }}
    >
      {actions.map((action) => (
        <SpeedDialAction
          key={action.label}
          icon={action.icon}
          tooltipTitle={action.label}
          onClick={() => action.onSelect()}
        />
      ))}
    </SpeedDial>
  );
}
