import { List, ListItem, ListItemText, Typography } from "@mui/material";
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
          <ListItem
            key={s.id}
            selected={selectedIndex === i}
            onClick={() => handleListItemClick(s.id, i)}
          >
            <ListItemText
              primary={s.attributes.name || s.id}
              secondary={s.id + "\n" + toLocaleString(s.attributes.created)}
            />
          </ListItem>
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
