import { SpeedDial, SpeedDialAction } from "@material-ui/core";
import { FileCopy, ZoomOutMap } from "@material-ui/icons";

import { Action, AnimationDurationMs } from "./Viewer";

interface Props {
  readonly viewer: React.MutableRefObject<HTMLVertexViewerElement | null>;
}

export function ViewerSpeedDial({ viewer }: Props): JSX.Element {
  const actions: Action[] = [
    {
      icon: <ZoomOutMap />,
      name: "Fit all",
      onClick: () => fitAll(),
    },
    {
      icon: <FileCopy />,
      name: "Copy Camera",
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

  async function fitAll(): Promise<void> {
    (await viewer.current?.scene())
      ?.camera()
      .viewAll()
      .render({ animation: { milliseconds: AnimationDurationMs } });
  }

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
