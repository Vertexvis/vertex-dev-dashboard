import {
  List,
  ListItemButton,
  ListItemText,
  Typography,
} from "@material-ui/core";
import { SceneViewStateData } from "@vertexvis/api-client-node";
import React from "react";

import { toLocaleString } from "../../lib/dates";

interface Props {
  readonly sceneViewStates?: SceneViewStateData[];
  readonly onViewStateSelected: (arg0: string) => void;
}

export function SceneViewStateList({
  sceneViewStates,
  onViewStateSelected,
}: Props): JSX.Element {
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  if (!sceneViewStates || !sceneViewStates.length) return <NoData />;

  const handleListItemClick = (id: string, index: number) => {
    onViewStateSelected(id);
    setSelectedIndex(index);
  };

  return (
    <List>
      {sceneViewStates.map((s, i) => {
        return (
          <ListItemButton
            key={s.id}
            selected={selectedIndex === i}
            onClick={() => handleListItemClick(s.id, i)}
          >
            <ListItemText
              primary={s.attributes.name || s.id}
              secondary={toLocaleString(s.attributes.created)}
            />
          </ListItemButton>
        );
      })}
    </List>
  );
}

function NoData(): JSX.Element {
  return (
    <Typography sx={{ mx: 2, mb: 2 }} variant="body2">
      No scene view states.
    </Typography>
  );
}
