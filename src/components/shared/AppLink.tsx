import { Link as MuiLink, LinkProps as MuiLinkProps } from "@mui/material";
import NextLink, { LinkProps as NextLinkProps } from "next/link";

export type AppLinkProps = Omit<MuiLinkProps, "href"> &
  Pick<
    NextLinkProps,
    "href" | "locale" | "prefetch" | "replace" | "scroll" | "shallow"
  >;

export function AppLink(props: AppLinkProps): JSX.Element {
  return <MuiLink component={NextLink} {...props} />;
}
