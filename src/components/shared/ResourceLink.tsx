import { Box, BoxProps, Tooltip } from "@mui/material";
import React from "react";

type ResourceLinkProps = Omit<BoxProps<"span">, "onClick"> & {
  readonly onPrimaryAction: () => void;
  readonly primaryActionLabel: string;
};

export function ResourceLink({
  children,
  onPrimaryAction,
  primaryActionLabel,
  sx,
  ...props
}: ResourceLinkProps): JSX.Element {
  return (
    <Tooltip title={primaryActionLabel}>
      <Box
        component="span"
        role="button"
        tabIndex={0}
        aria-label={primaryActionLabel}
        onClick={(event) => {
          if (event.button !== 0) {
            return;
          }
          event.stopPropagation();
          onPrimaryAction();
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") {
            return;
          }

          event.preventDefault();
          event.stopPropagation();
          onPrimaryAction();
        }}
        sx={[
          {
            color: "inherit",
            cursor: "pointer",
            textDecoration: "underline",
            textDecorationColor: "transparent",
            "&:hover": {
              textDecorationColor: "currentColor",
            },
            "&:focus-visible": {
              outline: "auto",
              outlineOffset: 2,
              textDecorationColor: "currentColor",
            },
          },
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
        {...props}
      >
        {children}
      </Box>
    </Tooltip>
  );
}
