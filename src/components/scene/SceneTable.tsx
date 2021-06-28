import {
  Alert,
  Checkbox,
  CircularProgress,
  IconButton,
  Paper,
  Skeleton,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TablePagination,
  TableRow,
  Tooltip,
} from "@material-ui/core";
import {
  EditOutlined,
  VisibilityOutlined,
  VpnKeyOutlined,
} from "@material-ui/icons";
import { Environment } from "@vertexvis/viewer";
import { useRouter } from "next/router";
import React from "react";
import useSWR from "swr";

import { isErrorRes } from "../../lib/api";
import { SwrProps } from "../../lib/paging";
import { Scene, toScenePage } from "../../lib/scenes";
import { encodeCreds } from "../../pages/scene-viewer";
import { DataLoadError } from "../shared/DataLoadError";
import { HeadCell, TableHead } from "../shared/TableHead";
import { TableToolbar } from "../shared/TableToolbar";

interface Props {
  readonly clientId?: string;
  readonly onClick: (s: Scene) => void;
  readonly onEditClick: (s: Scene) => void;
  readonly scene?: Scene;
  readonly vertexEnv: Environment;
}

const headCells: readonly HeadCell[] = [
  { id: "name", disablePadding: true, label: "Name" },
  { id: "supplied-id", label: "Supplied ID" },
  { id: "state", label: "State" },
  { id: "id", label: "ID" },
  { id: "created", label: "Created" },
  { id: "actions", label: "Actions" },
];

async function fetcher(req: RequestInfo) {
  return (await fetch(req)).json();
}

function useScenes({ cursor, pageSize, suppliedId }: SwrProps) {
  return useSWR(
    `/api/scenes?pageSize=${pageSize}${cursor ? `&cursor=${cursor}` : ""}${
      suppliedId ? `&suppliedId=${suppliedId}` : ""
    }`,
    fetcher
  );
}

export function SceneTable({
  clientId,
  onClick,
  onEditClick,
  scene,
  vertexEnv,
}: Props): JSX.Element {
  const pageSize = 50;
  const rowHeight = 53;
  const [selected, setSelected] = React.useState<readonly string[]>([]);
  const [curPage, setCurPage] = React.useState(0);
  const [privateCursor, setPrivateCursor] = React.useState<
    string | undefined
  >();
  const [cursor, setCursor] = React.useState<string | undefined>();
  const { data, error } = useScenes({ cursor, pageSize });
  const [toastMsg, setToastMsg] = React.useState<string | undefined>();
  const [keyLoadingSceneId, setKeyLoadingSceneId] = React.useState<
    string | undefined
  >();

  const router = useRouter();
  const page = data ? toScenePage(data) : undefined;
  const pageLength = page ? page.items.length : 0;
  const emptyRows = privateCursor == null ? 0 : pageSize - pageLength;

  React.useEffect(() => {
    if (page == null) return;

    setPrivateCursor(page.cursor ?? undefined);
  }, [page]);

  function handleSelectAll(e: React.ChangeEvent<HTMLInputElement>) {
    if (page == null) return;

    setSelected(e.target.checked ? page.items.map((n) => n.id) : []);
  }

  function handleCheck(id: string) {
    const selectedIndex = selected.indexOf(id);
    let upd: readonly string[] = [];

    if (selectedIndex === -1) {
      upd = upd.concat(selected, id);
    } else if (selectedIndex === 0) {
      upd = upd.concat(selected.slice(1));
    } else if (selectedIndex === selected.length - 1) {
      upd = upd.concat(selected.slice(0, -1));
    } else if (selectedIndex > 0) {
      upd = upd.concat(
        selected.slice(0, selectedIndex),
        selected.slice(selectedIndex + 1)
      );
    }

    setSelected(upd);
  }

  function handleClick(s: Scene) {
    onClick(s);
  }

  function handleChangePage(_e: unknown, n: number) {
    setCursor(privateCursor);
    setCurPage(n);
  }

  async function handleDelete() {
    await fetch("/api/scenes", {
      body: JSON.stringify({ ids: selected }),
      method: "DELETE",
    });
  }

  function handleEditClick(s: Scene) {
    onEditClick(s);
  }

  async function handleViewClick(sceneId: string) {
    if (!clientId) return;

    const json = await (
      await fetch("/api/stream-keys", {
        body: JSON.stringify({ id: sceneId }),
        method: "POST",
      })
    ).json();

    if (isErrorRes(json)) console.error("Error creating stream key.", json);
    else router.push(encodeCreds({ clientId, streamKey: json.key, vertexEnv }));
  }

  async function handleGetStreamKey(sceneId: string) {
    setKeyLoadingSceneId(sceneId);
    const b = await fetch("/api/stream-keys", {
      body: JSON.stringify({ sceneId }),
      method: "POST",
    });
    const { key } = await b.json();
    await navigator.clipboard.writeText(key);
    setKeyLoadingSceneId(undefined);
    setToastMsg(`Stream key "${key}" copied to clipboard.`);
  }

  const isSelected = (name: string) => selected.indexOf(name) !== -1;

  return (
    <>
      <Paper sx={{ m: 2 }}>
        <TableToolbar
          numSelected={selected.length}
          onDelete={handleDelete}
          title="Scenes"
        />
        <TableContainer>
          <Table>
            <TableHead
              headCells={headCells}
              numSelected={selected.length}
              onSelectAllClick={handleSelectAll}
              rowCount={pageLength}
            />
            <TableBody>
              {error ? (
                <DataLoadError colSpan={headCells.length + 1} />
              ) : !page ? (
                Array(emptyRows)
                  .fill(0)
                  .map((_, i) => (
                    <TableRow key={i} role="checkbox" tabIndex={-1}>
                      <TableCell padding="checkbox">
                        <Checkbox disabled />
                      </TableCell>
                      <TableCell component="th" scope="row" padding="none">
                        <Skeleton />
                      </TableCell>
                      <TableCell>
                        <Skeleton />
                      </TableCell>
                      <TableCell>
                        <Skeleton />
                      </TableCell>
                      <TableCell>
                        <Skeleton />
                      </TableCell>
                      <TableCell>
                        <Skeleton />
                      </TableCell>
                      <TableCell>
                        <Skeleton />
                      </TableCell>
                    </TableRow>
                  ))
              ) : (
                page.items.map((row, index) => {
                  const isSel = isSelected(row.id);
                  const labelId = `table-checkbox-${index}`;

                  return (
                    <TableRow
                      hover
                      role="checkbox"
                      tabIndex={-1}
                      key={row.id}
                      selected={isSel}
                      onClick={() => handleClick(row)}
                    >
                      <TableCell
                        padding="checkbox"
                        onClick={() => handleCheck(row.id)}
                      >
                        <Checkbox color="primary" checked={isSel} />
                      </TableCell>
                      <TableCell
                        component="th"
                        id={labelId}
                        scope="row"
                        padding="none"
                      >
                        {row.name}
                      </TableCell>
                      <TableCell>{row.suppliedId}</TableCell>
                      <TableCell>{row.state}</TableCell>
                      <TableCell>{row.id}</TableCell>
                      <TableCell>
                        {row.created
                          ? new Date(row.created).toLocaleString()
                          : undefined}
                      </TableCell>
                      <TableCell>
                        <>
                          {keyLoadingSceneId === row.id && (
                            <CircularProgress
                              size={36}
                              sx={{ position: "absolute" }}
                            />
                          )}
                          <Tooltip title="Generate stream key">
                            <IconButton
                              aria-label="stream-key"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleGetStreamKey(row.id);
                              }}
                            >
                              <VpnKeyOutlined fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                        <Tooltip title="View scene">
                          <IconButton
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewClick(row.id);
                            }}
                          >
                            <VisibilityOutlined />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit scene">
                          <IconButton
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditClick(row);
                            }}
                          >
                            <EditOutlined />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
              {emptyRows > 0 && (
                <TableRow style={{ height: rowHeight * emptyRows }}>
                  <TableCell colSpan={headCells.length + 1} />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[]}
          component="div"
          count={-1}
          rowsPerPage={pageSize}
          page={curPage}
          onPageChange={handleChangePage}
          nextIconButtonProps={{ disabled: privateCursor == null }}
        />
      </Paper>
      <Snackbar
        open={!!toastMsg}
        autoHideDuration={6000}
        onClose={() => setToastMsg(undefined)}
      >
        <Alert onClose={() => setToastMsg(undefined)} severity="success">
          {toastMsg}
        </Alert>
      </Snackbar>
    </>
  );
}
