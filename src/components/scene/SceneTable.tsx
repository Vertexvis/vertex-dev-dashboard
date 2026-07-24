import { MergeTypeOutlined } from '@mui/icons-material';
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
} from '@mui/material';
import { SceneData } from '@vertexvis/api-client-node';
import { useRouter } from 'next/router';
import { debounce, Nullable, useQueryStates } from 'nuqs';
import React, { useEffect } from 'react';
import useSWR from 'swr';

import { ErrorRes, GetRes } from '../../lib/api';
import { toLocaleString } from '../../lib/dates';
import { useUrlCursorPaging } from '../../lib/nuqs-table-state';
import { SwrProps } from '../../lib/paging';
import { Scene, toScenePage } from '../../lib/scenes';
import {
  sceneTableParsers,
  SceneTableState,
  sceneTableUrlKeys,
} from '../../lib/scenes-nuqs-state';
import CreateSceneDialog from '../shared/CreateSceneDialog';
import { formatCursorPaginationLabel } from '../shared/cursor-pagination';
import { DataLoadError } from '../shared/DataLoadError';
import { DefaultPageSize, DefaultRowHeight } from '../shared/Layout';
import { ResourceLink } from '../shared/ResourceLink';
import { RowActionsMenu } from '../shared/RowActionsMenu';
import { SkeletonBody } from '../shared/SkeletonBody';
import { HeadCell, TableHead } from '../shared/TableHead';
import { TableToolbar } from '../shared/TableToolbar';

interface Props {
  readonly onClick: (s: Scene) => void;
  readonly onEditClick: (s: Scene) => void;
  readonly scene?: Scene;
  readonly invalidationCount: number;
}

const FilterDebounceMs = 300;

const headCells: readonly HeadCell[] = [
  { id: 'name', disablePadding: true, label: 'Name' },
  { id: 'supplied-id', label: 'Supplied ID' },
  { id: 'state', label: 'State' },
  { id: 'id', label: 'ID' },
  { id: 'created', label: 'Created' },
  { id: 'actions', label: 'Actions' },
];

function useScenes({
  cursor,
  pageSize,
  suppliedId,
  name,
}: SwrProps): ReturnType<typeof useSWR> {
  return useSWR<GetRes<SceneData>, ErrorRes>(
    `/api/scenes?pageSize=${pageSize}${cursor ? `&cursor=${cursor}` : ''}${
      suppliedId ? `&suppliedId=${encodeURIComponent(suppliedId)}` : ''
    }${name ? `&name=${encodeURIComponent(name)}` : ''}`
  );
}

function stateColor(state?: string): 'default' | 'success' | 'warning' | 'error' {
  switch (state) {
    case 'commit':
    case 'committed':
    case 'ready':
      return 'success';
    case 'draft':
      return 'warning';
    case 'error':
    case 'failed':
      return 'error';
    default:
      return 'default';
  }
}

export default function SceneTable({
  onClick,
  onEditClick,
  scene,
  invalidationCount,
}: Props): JSX.Element {
  const pageSize = DefaultPageSize;
  const [state, setState] = useQueryStates(sceneTableParsers, {
    urlKeys: sceneTableUrlKeys,
  });
  const [showMergeScene, setShowMergeScene] = React.useState(false);
  const [keyLoadingSceneId, setKeyLoadingSceneId] = React.useState<string | undefined>();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [activeSceneId, setActiveSceneId] = React.useState<string | undefined>(
    () => scene?.id
  );
  const [toastMsg, setToastMsg] = React.useState<string | undefined>();

  const { data, error, mutate } = useScenes({
    cursor: state.cursor ?? undefined,
    pageSize,
    suppliedId: state.suppliedId?.trim() || undefined,
    name: state.name?.trim() || undefined,
  });

  useEffect(() => {
    void mutate();
  }, [invalidationCount, mutate]);

  const router = useRouter();
  const page = data ? toScenePage(data) : undefined;
  const pageLength = page ? page.items.length : 0;
  const paging = useUrlCursorPaging({
    cursor: state.cursor,
    cursors: page?.cursors ?? undefined,
    loaded: page != null,
    page: state.page,
    searchKey: JSON.stringify({
      name: state.name,
      suppliedId: state.suppliedId,
    }),
    setPaging: (patch) => void setState(patch, { history: 'push' }),
  });
  const { paginationCursors } = paging;
  const emptyRows =
    paginationCursors?.next == null && paginationCursors?.self == null
      ? 0
      : pageSize - pageLength;

  function handleFilterChange(field: 'name' | 'suppliedId', value: string): void {
    const patch: Partial<Nullable<SceneTableState>> = {
      cursor: null,
      page: null,
    };
    patch[field] = value === '' ? null : value;

    paging.resetPagingCache();
    void setState(patch, { limitUrlUpdates: debounce(FilterDebounceMs) });
  }

  React.useEffect(() => {
    if (scene != null) setActiveSceneId(scene.id);
  }, [scene]);

  function handleSelectAll(e: React.ChangeEvent<HTMLInputElement>): void {
    if (page == null) return;

    const upd = new Set<string>();
    if (e.target.checked) page.items.map((n) => upd.add(n.id));
    setSelected(upd);
  }

  function handleCheck(id: string): void {
    const upd = new Set(selected);
    if (selected.has(id)) upd.delete(id);
    else upd.add(id);

    setSelected(upd);
  }

  function handleClick(s: Scene): void {
    setActiveSceneId(s.id);
    onClick(s);
  }

  async function handleDelete(): Promise<void> {
    setSelected(new Set());
    await fetch('/api/scenes', {
      body: JSON.stringify({ ids: [...selected] }),
      method: 'DELETE',
    });
    await mutate();
  }

  function handleEditClick(s: Scene): void {
    setActiveSceneId(s.id);
    onEditClick(s);
  }

  function handleViewClick(sceneId: string): void {
    void router.push(`/scene-viewer/${encodeURIComponent(sceneId)}`);
  }

  async function handleGetStreamKey(sceneId: string): Promise<void> {
    setKeyLoadingSceneId(sceneId);
    const b = await fetch('/api/stream-keys', {
      body: JSON.stringify({ id: sceneId }),
      method: 'POST',
    });
    const { key } = await b.json();
    try {
      await navigator.clipboard.writeText(key);
      setToastMsg(`Stream key "${key}" copied to clipboard.`);
    } catch (e) {
      console.error('Error copying stream key to clipboard', e);
    } finally {
      setKeyLoadingSceneId(undefined);
    }
  }

  return (
    <>
      <Paper sx={{ m: 2 }}>
        <TableToolbar
          numSelected={selected.size}
          onDelete={() => void handleDelete()}
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
            display: 'flex',
            gap: '1rem',
            justifyContent: 'flex-start',
            alignItems: 'center',
          }}
        >
          <TextField
            variant="standard"
            size="small"
            margin="normal"
            id="nameFilter"
            label="Name Filter"
            type="text"
            onChange={(e) => handleFilterChange('name', e.target.value)}
            sx={{ mt: 0, width: '20rem' }}
            value={state.name ?? ''}
          />
          <TextField
            variant="standard"
            size="small"
            margin="normal"
            id="suppliedIdFilter"
            label="Supplied ID Filter"
            type="text"
            onChange={(e) => handleFilterChange('suppliedId', e.target.value)}
            sx={{ mt: 0, width: '20rem' }}
            value={state.suppliedId ?? ''}
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
                          label={row.state ?? 'N/A'}
                          size="small"
                          sx={{ fontWeight: 600, textTransform: 'uppercase' }}
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
                              label: 'Generate stream key',
                              onClick: () => void handleGetStreamKey(row.id),
                            },
                            {
                              label: 'View scene',
                              onClick: () => handleViewClick(row.id),
                            },
                            {
                              label: 'Edit scene',
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
              paginationCursors?.next != null,
              pageLength,
              page != null
            )
          }
          rowsPerPage={pageSize}
          page={state.page}
          onPageChange={paging.handleChangePage}
          slotProps={{
            actions: {
              nextButton: { disabled: paging.nextDisabled },
              previousButton: { disabled: paging.previousDisabled },
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
          setToastMsg('Building merged scene. Check back shortly.');
          setShowMergeScene(false);
        }}
        scenesToMerge={Array.from(selected)}
      />
    </>
  );
}
