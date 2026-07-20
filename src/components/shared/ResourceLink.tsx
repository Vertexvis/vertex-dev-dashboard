import { Box, BoxProps, Tooltip } from "@mui/material";
import NextLink from "next/link";
import React from "react";

type ResourceLinkProps = Omit<BoxProps<"a">, "component" | "onClick"> & {
  readonly component?: React.ElementType;
  readonly disabled?: boolean;
  readonly href?: string;
  readonly onPrimaryAction?: () => void;
  /** Disable viewport prefetching for resource pages with request-time side effects. */
  readonly prefetch?: boolean;
  readonly primaryActionLabel: string;
};

export function ResourceLink({
  children,
  component = NextLink,
  disabled = false,
  href,
  onPrimaryAction,
  prefetch = false,
  primaryActionLabel,
  sx,
  ...props
}: ResourceLinkProps): JSX.Element {
  const linkComponent = disabled ? "a" : component;

  return (
    <Tooltip title={primaryActionLabel}>
      <Box
        component={linkComponent}
        href={disabled ? undefined : href ?? "#"}
        {...(linkComponent === NextLink ? { prefetch } : {})}
        role="link"
        tabIndex={disabled ? -1 : undefined}
        aria-disabled={disabled}
        aria-label={primaryActionLabel}
        onClick={(event: React.MouseEvent<HTMLAnchorElement>) => {
          if (disabled) {
            event.preventDefault();
            return;
          }

          event.stopPropagation();
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
