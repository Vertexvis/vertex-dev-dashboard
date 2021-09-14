import {
  AppBar as MuiAppBar,
  AppBarProps as MuiAppBarProps,
  Box,
  Toolbar,
} from "@mui/material";
import { styled } from "@mui/material/styles";

import useUser from "../../lib/hooks/use-user";
import { easeOutEntering, sharpLeaving } from "../../lib/transitions";
import { Header } from "./Header";
import { LeftDrawer } from "./LeftDrawer";

interface Props {
  readonly main: React.ReactNode;
  readonly rightDrawer?: React.ReactNode;
  readonly rightDrawerOpen?: boolean;
}

interface AppBarProps extends MuiAppBarProps {
  readonly open?: boolean;
}

export const DefaultPageSize = 25;
export const DefaultRowHeight = 72;
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
    marginRight: -RightDrawerWidth,
    maxWidth: `calc(100% - ${LeftDrawerWidth}px)`,
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
  const { user } = useUser({ redirectTo: "/login" });

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
        {user && main}
      </Main>
      {rightDrawer}
    </Box>
  );
}
