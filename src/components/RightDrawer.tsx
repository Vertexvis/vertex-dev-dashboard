import {
  Box,
  Drawer,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Typography,
} from "@material-ui/core";
import { Close } from "@material-ui/icons";
import React from "react";

import { Scene } from "../lib/scenes";
import { DrawerWidth } from "../pages/index";
import { VectorTable } from "./VectorTable";

export function RightDrawer({
  handleClose,
  scene,
}: {
  scene?: Scene;
  handleClose: () => void;
}): JSX.Element {
  return (
    <Drawer
      anchor="right"
      open={Boolean(scene)}
      sx={{
        flexShrink: 0,
        width: DrawerWidth,
        "& .MuiDrawer-paper": { width: DrawerWidth },
      }}
      variant="persistent"
    >
      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        <IconButton onClick={handleClose}>
          <Close />
        </IconButton>
      </Box>
      {scene && (
        <Box>
          <Typography sx={{ mb: 2, mx: 2 }} variant="h5">
            Scene Details
          </Typography>
          <TableContainer>
            <Table size="small" style={{ whiteSpace: "nowrap" }}>
              <TableBody>
                <TableRow>
                  <TableCell>
                    <Typography variant="subtitle2">Name</Typography>
                    <Typography variant="body2">{scene.name}</Typography>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <Typography variant="subtitle2">Supplied ID</Typography>
                    <Typography variant="body2">{scene.suppliedId}</Typography>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <Typography variant="subtitle2">ID</Typography>
                    <Typography variant="body2">{scene.id}</Typography>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <Typography variant="subtitle2">State</Typography>
                    <Typography variant="body2">{scene.state}</Typography>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <Typography variant="subtitle2">Tree enabled</Typography>
                    <Typography variant="body2">
                      {(scene.treeEnabled ?? false).toString()}
                    </Typography>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <Typography variant="subtitle2">Created</Typography>
                    <Typography variant="body2">
                      {scene.created
                        ? new Date(scene.created).toLocaleString()
                        : undefined}
                    </Typography>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <Typography variant="subtitle2">Modified</Typography>
                    <Typography variant="body2">
                      {scene.modified
                        ? new Date(scene.modified).toLocaleString()
                        : undefined}
                    </Typography>
                  </TableCell>
                </TableRow>
                {scene.camera && (
                  <TableRow>
                    <TableCell>
                      <Typography variant="subtitle2">Camera</Typography>
                      <Table size="small">
                        <TableBody>
                          <TableRow>
                            <TableCell>
                              <Typography variant="subtitle2">
                                Position
                              </Typography>
                              <VectorTable vector={scene.camera.position} />
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>
                              <Typography variant="subtitle2">
                                Look at
                              </Typography>
                              <VectorTable vector={scene.camera.lookAt} />
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ border: 0 }}>
                              <Typography variant="subtitle2">Up</Typography>
                              <VectorTable vector={scene.camera.up} />
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableCell>
                  </TableRow>
                )}
                {scene.worldOrientation && (
                  <TableRow>
                    <TableCell>
                      <Typography variant="subtitle2">
                        World orientation
                      </Typography>
                      <Table size="small">
                        <TableBody>
                          <TableRow>
                            <TableCell>
                              <Typography variant="subtitle2">Front</Typography>
                              <VectorTable
                                vector={scene.worldOrientation.front}
                              />
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ border: 0 }}>
                              <Typography variant="subtitle2">Up</Typography>
                              <VectorTable vector={scene.worldOrientation.up} />
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableCell>
                  </TableRow>
                )}
                {scene.sceneItemCount && (
                  <TableRow>
                    <TableCell>
                      <Typography variant="subtitle2">
                        Scene item count
                      </Typography>
                      <Typography variant="body2">
                        {scene.sceneItemCount}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}
    </Drawer>
  );
}
