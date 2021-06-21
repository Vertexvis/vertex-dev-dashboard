import { Drawer, IconButton } from "@material-ui/core";
import { styled } from "@material-ui/core/styles";
import { ChevronRight } from "@material-ui/icons";
import React from "react";

import { RightDrawerWidth } from "./Layout";

interface Props {
  readonly onClose: () => void;
  readonly open: boolean;
}

const DrawerHeader = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  padding: theme.spacing(0, 1),
  ...theme.mixins.toolbar,
  justifyContent: "flex-start",
}));

export function DetailsRightDrawer({ onClose, open }: Props): JSX.Element {
  return (
    <Drawer
      sx={{
        width: RightDrawerWidth,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: RightDrawerWidth,
        },
      }}
      variant="persistent"
      anchor="right"
      open={open}
    >
      <DrawerHeader>
        <IconButton onClick={onClose}>
          <ChevronRight />
        </IconButton>
      </DrawerHeader>
      Hey there
    </Drawer>
  );
}
