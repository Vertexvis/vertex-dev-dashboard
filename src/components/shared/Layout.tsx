import {
  AppBar as MuiAppBar,
  AppBarProps as MuiAppBarProps,
  Box,
  Toolbar,
} from "@material-ui/core";
import { styled } from "@material-ui/core/styles";
import { useSession } from "next-auth/client";
import React from "react";

import { easeOutEntering, sharpLeaving } from "../../lib/transitions";
import { Header } from "./Header";
import { LeftDrawer } from "./LeftDrawer";
import { SignInRequired } from "./SignInRequired";

interface Props {
  readonly main: React.ReactNode;
  readonly rightDrawer?: React.ReactNode;
  readonly rightDrawerOpen?: boolean;
}

interface AppBarProps extends MuiAppBarProps {
  readonly open?: boolean;
}

export const LeftDrawerWidth = 300;
export const RightDrawerWidth = 300;

export const AppBar = styled(MuiAppBar, {
  shouldForwardProp: (prop) => prop !== "open",
})<AppBarProps>(({ theme, open }) => {
  const { create } = theme.transitions;
  return {
    transition: create(["margin", "width"], sharpLeaving(theme)),
    zIndex: theme.zIndex.drawer + 1,
    ...(open && {
      marginRight: RightDrawerWidth,
      transition: create(["margin", "width"], easeOutEntering(theme)),
      width: `calc(100% - ${RightDrawerWidth}px)`,
    }),
  };
});

export const Main = styled("main", {
  shouldForwardProp: (prop) => prop !== "open",
})<{
  open?: boolean;
}>(({ theme, open }) => {
  const { create } = theme.transitions;
  return {
    flexGrow: 1,
    maxWidth: `calc(100% - ${LeftDrawerWidth}px)`,
    marginRight: -RightDrawerWidth,
    transition: create("margin", sharpLeaving(theme)),
    ...(open && {
      marginRight: 0,
      transition: create("margin", easeOutEntering(theme)),
    }),
  };
});

export function Layout({
  main,
  rightDrawer,
  rightDrawerOpen,
}: Props): JSX.Element {
  const [session] = useSession();

  return (
    <Box sx={{ display: "flex", height: "100vh" }}>
      <AppBar color="default" open={rightDrawerOpen} position="fixed">
        <Toolbar variant="dense">
          <Header />
        </Toolbar>
      </AppBar>
      <LeftDrawer />
      <Main open={rightDrawerOpen}>
        <Toolbar variant="dense" />
        {session != null ? main : <SignInRequired />}
      </Main>
      {rightDrawer}
    </Box>
  );
}
