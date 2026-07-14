import { Box, BoxProps, Tooltip } from "@mui/material";
import React from "react";

type ResourceLinkProps = Omit<BoxProps<"a">, "onClick"> & {
  readonly disabled?: boolean;
  readonly href?: string;
  readonly onPrimaryAction: () => void;
  readonly primaryActionLabel: string;
};

export function ResourceLink({
  children,
  disabled = false,
  href,
  onPrimaryAction,
  primaryActionLabel,
  sx,
  ...props
}: ResourceLinkProps): JSX.Element {
  return (
    <Tooltip title={primaryActionLabel}>
      <Box
        component="a"
        href={disabled ? undefined : href ?? "#"}
        role="link"
        tabIndex={disabled ? -1 : undefined}
        aria-disabled={disabled}
        aria-label={primaryActionLabel}
        onClick={(event: React.MouseEvent<HTMLAnchorElement>) => {
          if (disabled || event.button !== 0) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          onPrimaryAction();
        }}
        onKeyDown={(event: React.KeyboardEvent<HTMLAnchorElement>) => {
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
            color: "text.primary",
            cursor: disabled ? "not-allowed" : "pointer",
            textDecoration: "underline",
            textDecorationColor: "currentColor",
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
