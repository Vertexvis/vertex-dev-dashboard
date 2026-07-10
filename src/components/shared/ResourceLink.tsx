import { Link as MuiLink, LinkProps as MuiLinkProps } from "@mui/material";
import React from "react";

type ResourceLinkProps = Omit<MuiLinkProps, "href"> & {
  readonly href?: string;
  readonly onOpen: () => void;
};

export function ResourceLink({
  children,
  href = "#",
  onOpen,
  ...props
}: ResourceLinkProps): JSX.Element {
  return (
    <MuiLink
      href={href}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onOpen();
      }}
      underline="hover"
      {...props}
    >
      {children}
    </MuiLink>
  );
}
