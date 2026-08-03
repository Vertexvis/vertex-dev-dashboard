import { Link as MuiLink, LinkProps as MuiLinkProps } from "@mui/material";
import NextLink, { LinkProps as NextLinkProps } from "next/link";
import React from "react";

export type AppLinkProps = Omit<MuiLinkProps, "href"> &
  Pick<
    NextLinkProps,
    "href" | "locale" | "prefetch" | "replace" | "scroll" | "shallow"
  >;

export const AppLink = React.forwardRef<HTMLAnchorElement, AppLinkProps>(
  function AppLink(props, ref): JSX.Element {
    return <MuiLink component={NextLink} ref={ref} {...props} />;
  }
);
