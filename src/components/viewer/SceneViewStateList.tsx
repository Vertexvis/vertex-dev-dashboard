import { Box, List, ListItem, ListItemText, Typography } from "@mui/material";
import { SceneViewStateData } from "@vertexvis/api-client-node";
import React from "react";

import { toLocaleString } from "../../lib/dates";
import { Title } from "../shared/Title";

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
    <>
      <DrawerTitle />
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
                secondary={
                  "ID: " +
                  s.id +
                  "\n" +
                  (s.attributes.suppliedId
                    ? `SUPPLIED-ID: ${s.attributes.suppliedId}\n`
                    : "") +
                  "CREATED: " +
                  toLocaleString(s.attributes.created)
                }
              />
            </ListItem>
          );
        })}
      </List>
    </>
  );
}

function NoData(): JSX.Element {
  return (<><DrawerTitle />
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexGrow: 1 }}>
      <Typography sx={{ mx: 2, mb: 2 }} variant="body2">
        No data
      </Typography>
    </Box>
  </>
  );
}

function DrawerTitle(): JSX.Element {
  return (
    <Title
      sx={{
        borderBottom: "1px solid #ccc",
      }}
    >
      Scene View States
    </Title>
  )
}