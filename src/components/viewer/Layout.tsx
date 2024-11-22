import { AppBar as MuiAppBar, Box, Toolbar } from "@mui/material";
import { styled } from "@mui/material/styles";
import React from "react";

export const HeaderHeight = 56;
export const BottomDrawerHeight = 240;
export const DenseToolbarHeight = 48;
export const LeftDrawerWidth = 300;
export const RightDrawerWidth = 320;

interface Props {
  readonly bottomDrawer?: React.ReactNode;
  readonly bottomDrawerOpen?: boolean;
  readonly children?: React.ReactNode;
  readonly header?: React.ReactNode;
  readonly leftDrawer?: React.ReactNode;
  readonly leftDrawerOpen?: boolean;
  readonly leftSidebar?: React.ReactNode;
  readonly main: React.ReactNode;
  readonly rightDrawer?: React.ReactNode;
  readonly rightDrawerOpen?: boolean;
  readonly rightSidebar?: React.ReactNode;
}

interface DrawerProps {
  readonly leftDrawerWidth: number;
  readonly rightDrawerWidth: number;
}

function shouldForwardProp(prop: PropertyKey): boolean {
  return (
    prop !== "bottomDrawerHeight" &&
    prop !== "leftDrawerWidth" &&
    prop !== "rightDrawerWidth" &&
    prop !== "toolbarHeight"
  );
}

const AppBar = styled(MuiAppBar, { shouldForwardProp })<DrawerProps>(
  ({ theme }) => {
    return {
      width: `100%`,
      zIndex: theme.zIndex.drawer + 1,
      [theme.breakpoints.down("sm")]: {
        margin: 0,
        width: `100%`,
      },
    };
  }
);

const Main = styled("main", { shouldForwardProp })<{
  bottomDrawerHeight: number;
}>(({ bottomDrawerHeight }) => {
  return {
    position: "relative",
    flexGrow: 1,
    height: `calc(100% - ${bottomDrawerHeight}px)`,
    width: "100%",
  };
});

export function Layout({
  bottomDrawer,
  bottomDrawerOpen = false,
  children,
  header,
  leftSidebar,
  leftDrawer,
  leftDrawerOpen = false,
  main,
  rightSidebar,
  rightDrawer,
  rightDrawerOpen = false,
}: Props): JSX.Element {
  const bdh = bottomDrawerOpen ? BottomDrawerHeight : 0;
  const ldw = leftDrawerOpen ? LeftDrawerWidth : 0;
  const rdw = rightDrawerOpen ? RightDrawerWidth : 0;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {header && (
        <AppBar
          color="default"
          elevation={1}
          leftDrawerWidth={ldw}
          position="relative"
          rightDrawerWidth={rdw}
        >
          <Toolbar variant="dense">{header}</Toolbar>
        </AppBar>
      )}
      <Main
        sx={{
          display: "flex",
          height: `calc(100% - ${HeaderHeight}px)`,
        }}
        bottomDrawerHeight={bdh}
      >
        {leftSidebar}
        {leftDrawerOpen && leftDrawer ? leftDrawer : <></>}

        {main}

        {rightDrawerOpen && rightDrawer ? rightDrawer : <></>}
        {rightSidebar}
      </Main>
      {children ?? <></>}
      {bottomDrawerOpen && bottomDrawer ? bottomDrawer : <></>}
    </Box>
  );
}
