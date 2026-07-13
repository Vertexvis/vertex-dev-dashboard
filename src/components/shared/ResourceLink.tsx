import { Box, BoxProps, Tooltip } from "@mui/material";
import React from "react";

type ResourceLinkProps = Omit<BoxProps<"span">, "onClick"> & {
  readonly disabled?: boolean;
  readonly onPrimaryAction: () => void;
  readonly primaryActionLabel: string;
};

export function ResourceLink({
  children,
  disabled = false,
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
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label={primaryActionLabel}
        onClick={(event: React.MouseEvent<HTMLSpanElement>) => {
          if (disabled || event.button !== 0) {
            return;
          }
          event.stopPropagation();
          onPrimaryAction();
        }}
        onKeyDown={(event: React.KeyboardEvent<HTMLSpanElement>) => {
          if (disabled) {
            return;
          }
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
            cursor: disabled ? "not-allowed" : "pointer",
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
            ...(disabled && {
              opacity: 0.7,
              "&:focus-visible": {
                outline: "none",
              },
            }),
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
