import {
  ListItemIcon,
  ListItemText,
  MenuItem,
  MenuItemProps,
} from "@mui/material";
import React from "react";

import { Icon, IconName, IconSize } from "./Icon";

export interface Props extends MenuItemProps {
  label: string;
  iconName: IconName;
  iconSize: IconSize;
}

export const ContextMenuItem = (props: Props): JSX.Element => {
  const { label, iconName, iconSize, ...materialProps } = props;

  return (
    <MenuItem
      sx={{
        color: "#444",
      }}
      {...materialProps}
    >
      <ListItemIcon>
        <Icon size={iconSize} name={iconName} />
      </ListItemIcon>
      <ListItemText
        primaryTypographyProps={{
          sx: {
            fontSize: "0.875rem",
          },
        }}
      >
        {label}
      </ListItemText>
    </MenuItem>
  );
};
