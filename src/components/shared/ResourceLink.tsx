import { Box, BoxProps, Tooltip } from "@mui/material";
import React from "react";

type ResourceLinkProps = Omit<BoxProps<"a">, "component" | "onClick"> & {
  readonly component?: React.ElementType;
  readonly disabled?: boolean;
  readonly href?: string;
  readonly onPrimaryAction?: () => void;
  readonly primaryActionLabel: string;
};

export function ResourceLink({
  children,
  component = "a",
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
        component={component}
        href={disabled ? undefined : href ?? "#"}
        role="link"
        tabIndex={disabled ? -1 : undefined}
        aria-disabled={disabled}
        aria-label={primaryActionLabel}
        onClick={(event: React.MouseEvent<HTMLAnchorElement>) => {
          event.stopPropagation();
          if (disabled) {
            event.preventDefault();
            return;
          }
          if (event.button !== 0 || href != null) return;

          event.preventDefault();
          onPrimaryAction?.();
        }}
        onKeyDown={(event: React.KeyboardEvent<HTMLAnchorElement>) => {
          event.stopPropagation();
          if (disabled || href != null) return;
          if (event.key !== "Enter" && event.key !== " ") {
            return;
          }

          event.preventDefault();
          onPrimaryAction?.();
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
