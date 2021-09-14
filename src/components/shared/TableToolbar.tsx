import { IconButton, Toolbar, Tooltip, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Delete } from "@mui/icons-material";
import React from "react";

interface Props {
  readonly numSelected: number;
  readonly onDelete: () => void;
  readonly title: string;
  readonly customActions?: React.ReactNode;
}

export const TableToolbar = ({
  numSelected,
  onDelete,
  title,
  customActions,
}: Props): JSX.Element => {
  return (
    <Toolbar
      sx={{
        pl: { sm: 2 },
        pr: { xs: 1, sm: 1 },
        ...(numSelected > 0 && {
          bgcolor: (theme) =>
            alpha(
              theme.palette.primary.main,
              theme.palette.action.activatedOpacity
            ),
        }),
      }}
    >
      {numSelected > 0 ? (
        <Typography
          sx={{ flex: "1 1 100%" }}
          color="inherit"
          variant="subtitle1"
          component="div"
        >
          {numSelected} selected
        </Typography>
      ) : (
        <Typography sx={{ flex: "1 1 100%" }} variant="h6" component="div">
          {title}
        </Typography>
      )}
      {numSelected > 1 && !!customActions ? customActions : <></>}
      {numSelected > 0 && (
        <Tooltip title="Delete">
          <IconButton onClick={() => onDelete()}>
            <Delete />
          </IconButton>
        </Tooltip>
      )}
    </Toolbar>
  );
};
