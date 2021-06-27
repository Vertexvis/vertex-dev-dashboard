import {
  Box,
  Button,
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
import { useForm } from "react-hook-form";

import { Scene } from "../lib/scenes";
import { UpdateSceneReq } from "../pages/api/scenes";
import { DrawerWidth } from "../pages/index";
import { Input } from "./Input";
import { VectorTable } from "./VectorTable";

interface Props {
  editing: boolean;
  scene?: Scene;
  open: boolean;
  onClose: () => void;
}

type FormData = Omit<UpdateSceneReq, "id">;

export function RightDrawer({
  editing,
  onClose,
  open,
  scene,
}: Props): JSX.Element {
  const defaultValues = scene;
  const { control, handleSubmit, reset } = useForm<FormData>({
    defaultValues,
  });

  async function onSubmit(data: FormData) {
    console.debug(
      await fetch("/api/scenes", {
        body: JSON.stringify({ id: scene?.id, ...data }),
        method: "PATCH",
      })
    );
    onClose();
  }

  React.useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  return (
    <Drawer
      anchor="right"
      open={open}
      sx={{
        flexShrink: 0,
        width: DrawerWidth,
        "& .MuiDrawer-paper": { width: DrawerWidth },
      }}
      variant="persistent"
    >
      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
        <Typography sx={{ my: 2, mx: 2 }} variant="h5">
          {editing ? "Edit Scene" : "Scene Details"}
        </Typography>
        <IconButton onClick={onClose} sx={{ mr: 2 }}>
          <Close />
        </IconButton>
      </Box>
      {scene && editing ? (
        <Box sx={{ mx: 2, mb: 2 }}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Input<FormData> control={control} label="Name" name="name" />
            <Input<FormData>
              control={control}
              label="Supplied ID"
              name="suppliedId"
            />
            <Box
              sx={{
                display: "flex",
                justifyContent: "flex-end",
                my: 2,
              }}
            >
              <Button onClick={onClose} sx={{ mr: 2 }}>
                Cancel
              </Button>
              <Button type="submit" variant="contained">
                Update
              </Button>
            </Box>
          </form>
          {/*
            <InputLabel id="select-label">State</InputLabel>
            <Select
              labelId="select-label"
              size="small"
              sx={{ width: "100%" }}
              value={scene.state}
            >
              <MenuItem value="draft">Draft</MenuItem>
              <MenuItem value="ready">Ready</MenuItem>
              <MenuItem value="commit">Commit</MenuItem>
            </Select>
            <FormControlLabel
              control={<Checkbox checked={scene.treeEnabled} size="small" />}
              label="Tree enabled"
            />
            {scene.camera && (
              <>
                <Vector
                  label="Camera position"
                  vector={scene.camera.position}
                />
                <Vector label="Camera lookAt" vector={scene.camera.lookAt} />
                <Vector label="Camera up" vector={scene.camera.up} />
              </>
            )}
            {scene.worldOrientation && (
              <>
                <Vector
                  label="World orientation up"
                  vector={scene.worldOrientation.up}
                />
                <Vector
                  label="World orientation front"
                  vector={scene.worldOrientation.front}
                />
              </>
            )}
          </Form> */}
        </Box>
      ) : scene ? (
        <>
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
        </>
      ) : (
        <></>
      )}
    </Drawer>
  );
}