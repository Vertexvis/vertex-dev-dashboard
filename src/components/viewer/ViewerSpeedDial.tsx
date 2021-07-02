import { SpeedDial, SpeedDialAction } from "@material-ui/core";
import { FileCopyOutlined, ZoomOutMapOutlined } from "@material-ui/icons";

import { fitAll } from "../../lib/scene-items";
import { Action } from "./Viewer";

interface Props {
  readonly viewer: React.MutableRefObject<HTMLVertexViewerElement | null>;
}

export function ViewerSpeedDial({ viewer }: Props): JSX.Element {
  const actions: Action[] = [
    {
      icon: <ZoomOutMapOutlined />,
      name: "Fit all",
      onClick: () => fitAll({ viewer: viewer.current }),
    },
    {
      icon: <FileCopyOutlined />,
      name: "Copy camera",
      onClick: async () => {
        const c = (await viewer.current?.scene())?.camera();
        if (c) {
          await navigator.clipboard.writeText(
            JSON.stringify({
              position: c?.position,
              up: c?.up,
              lookAt: c?.lookAt,
            })
          );
        }
      },
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
          key={action.name}
          icon={action.icon}
          tooltipTitle={action.name}
          onClick={() => action.onClick()}
        />
      ))}
    </SpeedDial>
  );
}
