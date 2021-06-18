import { AppBar as MuiAppBar, Box, Toolbar } from "@material-ui/core";
import { styled } from "@material-ui/core/styles";
import React from "react";

export const BottomDrawerHeight = 0; // If provided, set desired value
export const DenseToolbarHeight = 48;
export const LeftDrawerWidth = 240; // If mini-drawer provided, set to 76
export const RightDrawerWidth = 320; // If not provided, set to 0

interface Props {
  readonly bottomDrawer?: React.ReactNode;
  readonly children?: React.ReactNode;
  readonly header?: React.ReactNode;
  readonly leftDrawer?: React.ReactNode;
  readonly leftDrawerOpen?: boolean;
  readonly main: React.ReactNode;
  readonly rightDrawer?: React.ReactNode;
  readonly rightDrawerOpen?: boolean;
}

function shouldForwardProp(prop: PropertyKey): boolean {
  return (
    prop !== "leftDrawerOpen" &&
    prop !== "rightDrawerOpen" &&
    prop !== "toolbarHeight"
  );
}

const AppBar = styled(MuiAppBar, { shouldForwardProp })<{
  leftDrawerOpen?: boolean;
  rightDrawerOpen?: boolean;
}>(({ leftDrawerOpen, rightDrawerOpen, theme }) => {
  const ldw = leftDrawerOpen ? LeftDrawerWidth : 0;
  return {
    marginLeft: ldw,
    width: `100%`,
    [theme.breakpoints.down("md")]: {
      margin: 0,
      width: `100%`,
    },
    zIndex: theme.zIndex.drawer + 1,
    ...(rightDrawerOpen && {
      width: `calc(100% - ${ldw + RightDrawerWidth}px)`,
      marginRight: RightDrawerWidth,
    }),
  };
});

const Main = styled("main", { shouldForwardProp })<{
  leftDrawerOpen?: boolean;
  rightDrawerOpen?: boolean;
  toolbarHeight: number;
}>(({ leftDrawerOpen, rightDrawerOpen, theme, toolbarHeight }) => {
  const ldw = leftDrawerOpen ? LeftDrawerWidth : 0;
  return {
    flexGrow: 1,
    height: `calc(100% - ${BottomDrawerHeight + toolbarHeight}px)`,
    marginTop: `${toolbarHeight}px`,
    width: `calc(100% - ${ldw + RightDrawerWidth}px)`,
    [theme.breakpoints.down("sm")]: { width: `100%` },
    ...(rightDrawerOpen && {
      width: `calc(100% - ${ldw + RightDrawerWidth}px)`,
    }),
  };
});

export function Layout({
  bottomDrawer,
  children,
  header,
  leftDrawer,
  leftDrawerOpen = false,
  main,
  rightDrawer,
  rightDrawerOpen = false,
}: Props): JSX.Element {
  return (
    <Box height="100vh" display="flex">
      {header && (
        <AppBar
          color="default"
          elevation={1}
          leftDrawerOpen={leftDrawerOpen}
          position="fixed"
          rightDrawerOpen={rightDrawerOpen}
        >
          <Toolbar variant="dense">{header}</Toolbar>
        </AppBar>
      )}
      {leftDrawer ?? <></>}
      <Main
        leftDrawerOpen={leftDrawerOpen}
        rightDrawerOpen={rightDrawerOpen}
        toolbarHeight={header ? DenseToolbarHeight : 0}
      >
        {main}
      </Main>
      {rightDrawer ?? <></>}
      {children ?? <></>}
      {bottomDrawer ?? <></>}
    </Box>
  );
}
