import { IconButton, Tooltip } from "@mui/material";
import React from "react";

export interface Props {
  readonly active?: string;
  readonly name: string;
  readonly tooltip?: string;
  readonly children: React.ReactNode;

  readonly onSelectSidebar: (name?: string) => void;
}

export const SidebarIcon = ({
  active,
  name,
  tooltip,
  children,
  onSelectSidebar,
}: Props): JSX.Element => {
  const toggleSidebar = (name: string) => {
    if (name !== active) {
      onSelectSidebar(name);
    } else {
      onSelectSidebar(undefined);
    }
  };

  const button = (
    <IconButton
      onClick={() => toggleSidebar(name)}
      color={active === name ? "primary" : "default"}
    >
      {children}
    </IconButton>
  );

  return tooltip ? (
    <Tooltip title={tooltip} placement="left" enterDelay={500}>
      {button}
    </Tooltip>
  ) : (
    button
  );
};
