import { MergeTypeOutlined } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Paper,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TablePagination,
  TableRow,
  TextField,
} from "@mui/material";
import { Cursors, SceneData } from "@vertexvis/api-client-node";
import debounce from "lodash.debounce";
import { useRouter } from "next/router";
import React, { useEffect } from "react";
import useSWR from "swr";

import { ErrorRes, GetRes } from "../../lib/api";
import { toLocaleString } from "../../lib/dates";
import {
  buildQuery,
  cursorPagingStateFromQuery,
  cursorPagingStateToQuery,
  SwrProps,
  useCursorPagingState,
} from "../../lib/paging";
import { Scene, toScenePage } from "../../lib/scenes";
import { queryParamValue, updateRouterQuery } from "../../lib/url-state";
import CreateSceneDialog from "../shared/CreateSceneDialog";
import { formatCursorPaginationLabel } from "../shared/cursor-pagination";
import { DataLoadError } from "../shared/DataLoadError";
import { DefaultPageSize, DefaultRowHeight } from "../shared/Layout";
import { ResourceLink } from "../shared/ResourceLink";
import { RowActionsMenu } from "../shared/RowActionsMenu";
import { SkeletonBody } from "../shared/SkeletonBody";
import { HeadCell, TableHead } from "../shared/TableHead";
import { TableToolbar } from "../shared/TableToolbar";

interface Props {
  readonly onClick: (s: Scene) => void;
  readonly onEditClick: (s: Scene) => void;
  readonly scene?: Scene;
  readonly invalidationCount: number;
}

const headCells: readonly HeadCell[] = [
  { id: "name", disablePadding: true, label: "Name" },
  { id: "supplied-id", label: "Supplied ID" },
  { id: "state", label: "State" },
  { id: "id", label: "ID" },
  { id: "created", label: "Created" },
  { id: "actions", label: "Actions" },
];

const UrlStatePrefix = "scene";

function useScenes({ cursor, pageSize, suppliedId, name }: SwrProps) {
  return useSWR<GetRes<SceneData>, ErrorRes>(
    buildQuery("/api/scenes", {
      cursor,
      name,
      pageSize,
      suppliedId,
    })
  );
}

function stateColor(
  state?: string
): "default" | "success" | "warning" | "error" {
  switch (state) {
    case "commit":
    case "committed":
    case "ready":
      return "success";
    case "draft":
      return "warning";
    case "error":
    case "failed":
      return "error";
    default:
      return "default";
  }
}

export default function SceneTable({
  onClick,
  onEditClick,
  scene,
  invalidationCount,
}: Props): JSX.Element {
  const router = useRouter();
  const routerReady = router.isReady !== false;
  const pageSize = DefaultPageSize;
  const [showMergeScene, setShowMergeScene] = React.useState(false);
  const {
    currentPage,
    cursor,
    cursors,
    getPageStateForChange,
    handlePageChange,
    resetPaging,
    setCursors,
    setPagingState,
  } = useCursorPagingState(
    cursorPagingStateFromQuery(router.query, UrlStatePrefix)
  );
  const [keyLoadingSceneId, setKeyLoadingSceneId] = React.useState<
    string | undefined
  >();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [activeSceneId, setActiveSceneId] = React.useState<string | undefined>(
    () => scene?.id
  );
  const [suppliedId, setSuppliedIdFilter] = React.useState<string | undefined>(
    () => queryParamValue(router.query.sceneSuppliedId)
  );
  const [suppliedIdInput, setSuppliedIdInput] = React.useState(
    () => queryParamValue(router.query.sceneSuppliedId) ?? ""
  );
  const [nameFilter, setNameFilter] = React.useState<string | undefined>(() =>
    queryParamValue(router.query.sceneName)
  );
  const [nameInput, setNameInput] = React.useState(
    () => queryParamValue(router.query.sceneName) ?? ""
  );
  const [toastMsg, setToastMsg] = React.useState<string | undefined>();
  const initializedFromQuery = React.useRef(false);

  const { data, error, mutate } = useScenes({
    cursor,
    pageSize,
    suppliedId,
    name: nameFilter,
  });

  useEffect(() => {
    mutate();
  }, [invalidationCount, mutate]);

  const page = data ? toScenePage(data) : undefined;
  const pageLength = page ? page.items.length : 0;
  const emptyRows =
    cursors?.next == null && cursors?.self == null ? 0 : pageSize - pageLength;

  const updateSceneTableQuery = React.useCallback(
    (updates: Record<string, string | undefined>) => {
      if (!routerReady) return;

      updateRouterQuery(router, updates, "replace");
    },
    [router, routerReady]
  );

  const clearPagingQuery = React.useCallback(
    () => cursorPagingStateToQuery(UrlStatePrefix),
    []
  );

  const debouncedSetSuppliedIdFilter = React.useMemo(
    () =>
      debounce((value: string) => {
        const nextValue = value === "" ? undefined : value;
        resetPaging();
        setSuppliedIdFilter(nextValue);
        updateSceneTableQuery({
          sceneSuppliedId: nextValue,
          ...clearPagingQuery(),
        });
      }, 300),
    [clearPagingQuery, resetPaging, updateSceneTableQuery]
  );

  const debouncedSetNameFilter = React.useMemo(
    () =>
      debounce((value: string) => {
        const nextValue = value === "" ? undefined : value;
        resetPaging();
        setNameFilter(nextValue);
        updateSceneTableQuery({
          sceneName: nextValue,
          ...clearPagingQuery(),
        });
      }, 300),
    [clearPagingQuery, resetPaging, updateSceneTableQuery]
  );

  React.useEffect(() => {
    if (!routerReady || initializedFromQuery.current) return;

    initializedFromQuery.current = true;
    const nextName = queryParamValue(router.query.sceneName);
    const nextSuppliedId = queryParamValue(router.query.sceneSuppliedId);
    setNameFilter(nextName);
    setNameInput(nextName ?? "");
    setSuppliedIdFilter(nextSuppliedId);
    setSuppliedIdInput(nextSuppliedId ?? "");
    setPagingState(cursorPagingStateFromQuery(router.query, UrlStatePrefix));
  }, [router.query, routerReady, setPagingState]);

  React.useEffect(() => {
    if (page == null) return;

    setCursors(page.cursors ?? undefined);
  }, [page, setCursors]);

  React.useEffect(() => {
    if (scene != null) setActiveSceneId(scene.id);
  }, [scene]);

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
    setActiveSceneId(s.id);
    onClick(s);
  }

  function handleChangePage(
    _: React.MouseEvent<HTMLButtonElement> | null,
    num: number
  ) {
    const nextPagingState = getPageStateForChange(num);
    handlePageChange(num);
    updateSceneTableQuery(
      cursorPagingStateToQuery(UrlStatePrefix, nextPagingState)
    );
  }

  async function handleDelete() {
    setSelected(new Set());
    await fetch("/api/scenes", {
      body: JSON.stringify({ ids: [...selected] }),
      method: "DELETE",
    });
    mutate();
  }

  function handleEditClick(s: Scene) {
    setActiveSceneId(s.id);
    onEditClick(s);
  }

  function handleViewClick(sceneId: string) {
    router.push(`/scene-viewer/${encodeURIComponent(sceneId)}`);
  }

  async function handleGetStreamKey(sceneId: string) {
    setKeyLoadingSceneId(sceneId);
    const b = await fetch("/api/stream-keys", {
      body: JSON.stringify({ id: sceneId }),
      method: "POST",
    });
    const { key } = await b.json();
    try {
      await navigator.clipboard.writeText(key);
      setToastMsg(`Stream key "${key}" copied to clipboard.`);
    } catch (e) {
      console.error("Error copying stream key to clipboard", e);
    } finally {
      setKeyLoadingSceneId(undefined);
    }
  }

  return (
    <>
      <Paper sx={{ m: 2 }}>
        <TableToolbar
          numSelected={selected.size}
          onDelete={handleDelete}
          title="Scenes"
          customActions={[
            <React.Fragment key="merge">
              <Button
                startIcon={<MergeTypeOutlined />}
                onClick={() => setShowMergeScene(true)}
              >
                Merge
              </Button>
            </React.Fragment>,
          ]}
        />
        <Box
          sx={{
            px: { sm: 2 },
            display: "flex",
            gap: "1rem",
            justifyContent: "flex-start",
            alignItems: "center",
          }}
        >
          <TextField
            variant="standard"
            size="small"
            margin="normal"
            id="nameFilter"
            label="Name Filter"
            type="text"
            value={nameInput}
            onChange={(e) => {
              const value = e.target.value ?? "";
              setNameInput(value);
              debouncedSetNameFilter(value.trim());
            }}
            sx={{ mt: 0, width: "20rem" }}
          />
          <TextField
            variant="standard"
            size="small"
            margin="normal"
            id="suppliedIdFilter"
            label="Supplied ID Filter"
            type="text"
            value={suppliedIdInput}
            onChange={(e) => {
              const value = e.target.value ?? "";
              setSuppliedIdInput(value);
              debouncedSetSuppliedIdFilter(value.trim());
            }}
            sx={{ mt: 0, width: "20rem" }}
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
                  const isActive = activeSceneId === row.id;

                  return (
                    <TableRow
                      hover
                      role="checkbox"
                      tabIndex={-1}
                      key={row.id}
                      selected={isSel || isActive}
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
                        <ResourceLink
                          href={`/scene-viewer/${encodeURIComponent(row.id)}`}
                          primaryActionLabel={`Open ${row.name}`}
                        >
                          {row.name}
                        </ResourceLink>
                      </TableCell>
                      <TableCell>{row.suppliedId}</TableCell>
                      <TableCell>
                        <Chip
                          color={stateColor(row.state)}
                          label={row.state ?? "N/A"}
                          size="small"
                          sx={{ fontWeight: 600, textTransform: "uppercase" }}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>{row.id}</TableCell>
                      <TableCell>{toLocaleString(row.created)}</TableCell>
                      <TableCell>
                        <RowActionsMenu
                          actions={[
                            {
                              disabled: keyLoadingSceneId === row.id,
                              label: "Generate stream key",
                              onClick: () => handleGetStreamKey(row.id),
                            },
                            {
                              label: "View scene",
                              onClick: () => handleViewClick(row.id),
                            },
                            {
                              label: "Edit scene",
                              onClick: () => handleEditClick(row),
                            },
                          ]}
                          ariaLabel={`Actions for ${row.name}`}
                          loading={keyLoadingSceneId === row.id}
                        />
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
          labelDisplayedRows={(displayedRows) =>
            formatCursorPaginationLabel(
              displayedRows,
              cursors?.next != null,
              pageLength,
              page != null
            )
          }
          rowsPerPage={pageSize}
          page={currentPage}
          onPageChange={handleChangePage}
          slotProps={{
            actions: {
              nextButton: { disabled: cursors?.next == null },
            },
          }}
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
