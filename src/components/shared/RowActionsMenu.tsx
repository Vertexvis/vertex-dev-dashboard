import { MoreHoriz } from "@mui/icons-material";
import {
  CircularProgress,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
} from "@mui/material";
import React from "react";

export interface RowAction {
  readonly disabled?: boolean;
  readonly label: string;
  readonly onClick: () => void | Promise<void>;
}

interface RowActionsMenuProps {
  readonly actions: readonly RowAction[];
  readonly ariaLabel: string;
  readonly loading?: boolean;
}

export function RowActionsMenu({
  actions,
  ariaLabel,
  loading = false,
}: RowActionsMenuProps): JSX.Element | null {
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);

  if (actions.length === 0) {
    return null;
  }

  const open = anchorEl != null;

  return (
    <>
      <IconButton
        aria-label={ariaLabel}
        onClick={(event) => {
          event.stopPropagation();
          setAnchorEl(event.currentTarget);
        }}
        size="small"
      >
        {loading ? (
          <CircularProgress size={18} />
        ) : (
          <MoreHoriz fontSize="small" />
        )}
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        onClick={(event) => event.stopPropagation()}
      >
        {actions.map((action) => (
          <MenuItem
            key={action.label}
            disabled={action.disabled}
            onClick={() => {
              setAnchorEl(null);
              void action.onClick();
            }}
          >
            {loading && action.label === "Generate stream key" ? (
              <ListItemIcon>
                <CircularProgress size={16} />
              </ListItemIcon>
            ) : null}
            <ListItemText>{action.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
