import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  IconButton,
  Paper,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
} from "@material-ui/core";
import {
  EditOutlined,
  MergeTypeOutlined,
  VisibilityOutlined,
  VpnKeyOutlined,
} from "@material-ui/icons";
import { Cursors, SceneData } from "@vertexvis/api-client-node";
import { Environment } from "@vertexvis/viewer";
import debounce from "lodash.debounce";
import { useRouter } from "next/router";
import React from "react";
import useSWR from "swr";

import { ErrorRes, fetcher, GetRes, isErrorRes } from "../../lib/api";
import { toLocaleString } from "../../lib/dates";
import { SwrProps } from "../../lib/paging";
import { Scene, toScenePage } from "../../lib/scenes";
import { encodeCreds } from "../../pages/scene-viewer/[sceneId]";
import CreateSceneDialog from "../shared/CreateSceneDialog";
import { DataLoadError } from "../shared/DataLoadError";
import { DefaultPageSize, DefaultRowHeight } from "../shared/Layout";
import { SkeletonBody } from "../shared/SkeletonBody";
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

function useScenes({ cursor, pageSize, suppliedId }: SwrProps) {
  return useSWR<GetRes<SceneData>, ErrorRes>(
    `/api/scenes?pageSize=${pageSize}${cursor ? `&cursor=${cursor}` : ""}${
      suppliedId ? `&suppliedId=${suppliedId}` : ""
    }`,
    fetcher
  );
}

export default function SceneTable({
  clientId,
  onClick,
  onEditClick,
  vertexEnv,
}: Props): JSX.Element {
  const pageSize = DefaultPageSize;
  const [curPage, setCurPage] = React.useState(0);
  const [showMergeScene, setShowMergeScene] = React.useState(false);
  const [cursor, setCursor] = React.useState<string | undefined>();
  const [cursors, setCursors] = React.useState<Cursors | undefined>();
  const [keyLoadingSceneId, setKeyLoadingSceneId] = React.useState<
    string | undefined
  >();
  const [prev, setPrev] = React.useState<Record<number, string | undefined>>(
    {}
  );
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [suppliedId, setSuppliedIdFilter] = React.useState<
    string | undefined
  >();
  const [toastMsg, setToastMsg] = React.useState<string | undefined>();

  const { data, error } = useScenes({ cursor, pageSize, suppliedId });
  const router = useRouter();
  const page = data ? toScenePage(data) : undefined;
  const pageLength = page ? page.items.length : 0;
  const emptyRows =
    cursors?.next == null && cursors?.self == null ? 0 : pageSize - pageLength;

  const debouncedSetSuppliedIdFilter = React.useMemo(
    () => debounce(setSuppliedIdFilter, 300),
    []
  );

  React.useEffect(() => {
    if (page == null) return;

    setCursors(page.cursors ?? undefined);
  }, [page]);

  function handleSelectAll(e: React.ChangeEvent<HTMLInputElement>) {
    if (page == null) return;

    const upd = new Set<string>();
    if (e.target.checked) page.items.map((n) => upd.add(n.id));
    setSelected(upd);
  }

  function handleCheck(id: string) {
    const upd = new Set(selected);
    if (selected.has(id)) upd.delete(id);
    else upd.add(id);

    setSelected(upd);
  }

  function handleClick(s: Scene) {
    onClick(s);
  }

  function handleChangePage(
    _: React.MouseEvent<HTMLButtonElement> | null,
    num: number
  ) {
    if (curPage < num) {
      setPrev({ ...prev, [num - 1]: cursors?.self });
      setCursor(cursors?.next);
    }
    if (curPage > num) setCursor(prev[num]);
    setCurPage(num);
  }

  async function handleDelete() {
    setSelected(new Set());
    await fetch("/api/scenes", {
      body: JSON.stringify({ ids: [...selected] }),
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
    else
      router.push(
        encodeCreds({ clientId, streamKey: json.key, vertexEnv, sceneId })
      );
  }

  async function handleGetStreamKey(sceneId: string) {
    setKeyLoadingSceneId(sceneId);
    const b = await fetch("/api/stream-keys", {
      body: JSON.stringify({ id: sceneId }),
      method: "POST",
    });
    const { key } = await b.json();
    await navigator.clipboard.writeText(key);
    setKeyLoadingSceneId(undefined);
    setToastMsg(`Stream key "${key}" copied to clipboard.`);
  }

  return (
    <>
      <Paper sx={{ m: 2 }}>
        <TableToolbar
          numSelected={selected.size}
          onDelete={handleDelete}
          title="Scenes"
          customActions={[
            <>
              <Button
                startIcon={<MergeTypeOutlined />}
                onClick={() => setShowMergeScene(true)}
              >
                Merge
              </Button>
            </>,
          ]}
        />
        <Box
          sx={{
            px: { sm: 2 },
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <TextField
            variant="standard"
            size="small"
            margin="normal"
            id="suppliedIdFilter"
            label="Supplied ID Filter"
            type="text"
            onChange={(e) => {
              debouncedSetSuppliedIdFilter(e.target.value);
            }}
            sx={{ mt: 0 }}
          />
        </Box>
        <TableContainer>
          <Table>
            <TableHead
              headCells={headCells}
              numSelected={selected.size}
              onSelectAllClick={handleSelectAll}
              rowCount={pageLength}
            />
            <TableBody>
              {error ? (
                <DataLoadError colSpan={headCells.length + 1} />
              ) : !page ? (
                <SkeletonBody
                  includeCheckbox={true}
                  numCellsPerRow={7}
                  numRows={pageSize - pageLength}
                  rowHeight={DefaultRowHeight}
                />
              ) : (
                page.items.map((row) => {
                  const isSel = selected.has(row.id);

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
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCheck(row.id);
                        }}
                      >
                        <Checkbox color="primary" checked={isSel} />
                      </TableCell>
                      <TableCell component="th" scope="row" padding="none">
                        {row.name}
                      </TableCell>
                      <TableCell>{row.suppliedId}</TableCell>
                      <TableCell>{row.state}</TableCell>
                      <TableCell>{row.id}</TableCell>
                      <TableCell>{toLocaleString(row.created)}</TableCell>
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
                <TableRow sx={{ height: DefaultRowHeight * emptyRows }}>
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
          nextIconButtonProps={{ disabled: cursors?.next == null }}
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
      <CreateSceneDialog
        open={showMergeScene}
        onClose={() => setShowMergeScene(false)}
        onSceneQueued={() => {
          setToastMsg("Building merged scene. Check back shortly.");
          setShowMergeScene(false);
        }}
        scenesToMerge={Array.from(selected)}
      />
    </>
  );
}
