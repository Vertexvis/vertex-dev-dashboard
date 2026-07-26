import { Close } from "@mui/icons-material";
import {
  Box,
  Drawer,
  FormControlLabel,
  IconButton,
  List,
  ListItem,
  ListSubheader,
  Switch,
  Typography,
} from "@mui/material";
import React from "react";

import { useUserPreferences } from "../../contexts/UserPreferencesContext";
import { RightDrawerWidth } from "./Layout";

interface Props {
  readonly open: boolean;
  readonly onClose: () => void;
}

/**
 * Right-side settings panel. Structured as a titled section list so more
 * settings can be added later without restructuring.
 */
export function SettingsDrawer({ open, onClose }: Props): JSX.Element {
  const { preferences, setPreference } = useUserPreferences();

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      // The app's fixed AppBar is elevated to `zIndex.drawer + 1`, above the
      // default temporary-drawer modal (`zIndex.drawer`). Lift this modal to
      // the modal layer so its heading and close control render above the
      // AppBar rather than clipped behind it.
      sx={(theme) => ({
        zIndex: theme.zIndex.modal,
        "& .MuiDrawer-paper": { width: RightDrawerWidth },
      })}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
        <Typography sx={{ my: 2, mx: 2 }} variant="h5" component="h2">
          Settings
        </Typography>
        <IconButton
          onClick={onClose}
          sx={{ mr: 2 }}
          aria-label="Close settings"
        >
          <Close />
        </IconButton>
      </Box>
      <List subheader={<ListSubheader disableSticky>Navigation</ListSubheader>}>
        <ListItem>
          <FormControlLabel
            control={
              <Switch
                checked={preferences.doubleClickNavigates}
                onChange={(event) =>
                  setPreference("doubleClickNavigates", event.target.checked)
                }
              />
            }
            label="Open the resource page on double-click"
          />
        </ListItem>
      </List>
    </Drawer>
  );
}
