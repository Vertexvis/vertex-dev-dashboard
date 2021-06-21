import { Box, Button, Link, Menu, MenuItem } from "@material-ui/core";
import Image from "next/image";
import { signOut, useSession } from "next-auth/client";
import React from "react";

export function Header(): JSX.Element {
  const [session] = useSession();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <Box display="flex" justifyContent="space-between" width="100%">
      <Link href="/">
        <Image src="/vertex-logo.svg" alt="Vertex" width="29" height="28" />
      </Link>
      {session && (
        <>
          {!!session.user?.name && !!session.user?.image && (
            <Box display="flex" justifyContent="end" alignItems="center">
              <img
                src={session.user?.image}
                alt={session.user?.name}
                width={30}
                height={30}
                style={{
                  borderRadius: "50%",
                  width: "30px",
                  height: "30px",
                }}
              />

              <Button
                aria-controls="simple-menu"
                aria-haspopup="true"
                onClick={handleClick}
              >
                {session.user?.name}
              </Button>
              <Menu
                id="simple-menu"
                anchorEl={anchorEl}
                keepMounted
                open={Boolean(anchorEl)}
                onClose={handleClose}
              >
                <MenuItem>
                  <Link
                    href="https://developer.vertexvis.com/support"
                    rel="noreferrer"
                    style={{ alignSelf: "center" }}
                    target="_blank"
                  >
                    Support
                  </Link>
                </MenuItem>
                <MenuItem onClick={() => signOut()}>
                  <Link
                    href="/api/auth/signout"
                    style={{ alignSelf: "center" }}
                    target="_blank"
                  >
                    Logout
                  </Link>
                </MenuItem>
              </Menu>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
