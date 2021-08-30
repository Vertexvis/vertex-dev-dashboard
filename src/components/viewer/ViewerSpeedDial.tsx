import { SpeedDial, SpeedDialAction } from "@material-ui/core";

import { Action } from "./Viewer";

interface Props {
  readonly actions: Action[];
}

export function ViewerSpeedDial({ actions }: Props): JSX.Element {
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
