import { Link as MuiLink, LinkProps as MuiLinkProps } from "@mui/material";
import { useRouter } from "next/router";
import React from "react";

export type AppLinkProps = Omit<MuiLinkProps, "href"> & AppLinkBehaviorProps;

export function AppLink(props: AppLinkProps): JSX.Element {
  return <MuiLink component={AppLinkBehavior} {...props} />;
}

export interface AppLinkBehaviorProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  readonly href: string;
  readonly locale?: string | false;
  readonly prefetch?: boolean;
  readonly replace?: boolean;
  readonly scroll?: boolean;
  readonly shallow?: boolean;
}

export const AppLinkBehavior = React.forwardRef<
  HTMLAnchorElement,
  AppLinkBehaviorProps
>(function AppLinkBehavior(
  { href, locale, onClick, prefetch, replace, scroll, shallow, ...props },
  ref
) {
  const router = useRouter();

  React.useEffect(() => {
    if (prefetch === false || !href.startsWith("/")) return;
    if (typeof router.prefetch !== "function") return;

    router.prefetch(href).catch(() => undefined);
  }, [href, prefetch, router]);

  function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);

    if (!shouldHandleWithAppNavigation(event)) return;

    event.preventDefault();
    if (replace) router.replace(href, undefined, { locale, scroll, shallow });
    else router.push(href, undefined, { locale, scroll, shallow });
  }

  return <a ref={ref} href={href} onClick={handleClick} {...props} />;
});

export function shouldHandleWithAppNavigation(
  event: React.MouseEvent<HTMLAnchorElement>
): boolean {
  if (event.defaultPrevented) return false;
  if (event.button !== 0) return false;
  if (event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) {
    return false;
  }

  const target = event.currentTarget.getAttribute("target");
  return target == null || target === "" || target === "_self";
}
