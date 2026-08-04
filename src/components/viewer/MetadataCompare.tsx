import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import React from 'react';

import { IdentifierKeys, Metadata } from '../../lib/metadata';
import { DrawerTitle, MetadataStatus, NoData, StateMessage } from './MetadataStates';

// The three metadata sources the comparison can show, in fixed display order.
export type SourceId = 'unrestricted' | 'restricted' | 'stream';

interface SourceConfig {
  readonly id: SourceId;
  readonly label: string;
}

// Fixed left-to-right order for both the toggle and the table columns.
const Sources: readonly SourceConfig[] = [
  { id: 'unrestricted', label: 'Unrestricted' },
  { id: 'restricted', label: 'Restricted' },
  { id: 'stream', label: 'Stream' },
];

interface ColumnInfo {
  readonly title: string;
  readonly body: React.ReactNode;
}

// Descriptive content shown in the per-column help dialog.
const ColumnInfoMap: Record<SourceId, ColumnInfo> = {
  unrestricted: {
    title: 'Unrestricted metadata',
    body: (
      <>
        The complete, policy-agnostic metadata for the item. Fetched server-side from the
        Vertex REST API via <code>GET /api/scene-items/&#123;id&#125;</code> (
        <code>sceneItems.getSceneItem</code>) using the dashboard session&apos;s OAuth
        credentials. This path does not apply any property key policy, so it shows every
        property the item has — use it as the baseline to see what a policy removes.
      </>
    ),
  },
  restricted: {
    title: 'Restricted metadata',
    body: (
      <>
        The policy-aware view — what the restricted stream actually exposes. Queried
        through the Web SDK, <code>viewer.sceneItems.listSceneItemMetadata(itemId)</code>,
        against the scene view created from the current stream key (which has the selected
        property key policy applied). This is the source the metadata panel uses; keys the
        policy denies do not appear here.
      </>
    ),
  },
  stream: {
    title: 'Stream metadata',
    body: (
      <>
        Metadata delivered inline with the render stream. When you click (raycast) an item
        in the viewer, the hit response carries <code>hit.metadataProperties</code>,
        mapped via <code>toMetadata(&#123; hit &#125;)</code>. It is scoped to the same
        policy-applied stream key, but arrives as part of the pick/hit over the streaming
        connection rather than a separate query — and is only available for items selected
        by clicking in the viewer (not the scene tree).
      </>
    ),
  },
};

// Default column selection: the current two policy-comparison columns.
const DefaultColumns: readonly SourceId[] = ['unrestricted', 'restricted'];

const ColumnsStorageKey = 'viewer.metadataColumns';

interface Props {
  // Unrestricted = the full metadata from the server-side REST path that
  // IGNORES the property key policy (`/api/scene-items/{id}`).
  readonly unrestricted?: Metadata;
  // True when the unrestricted-baseline fetch failed. Without the baseline the
  // comparison cannot tell what a policy removed, so it must warn rather than
  // let the summary imply "no differences".
  readonly unrestrictedError?: boolean;
  // Restricted = the policy-aware metadata from the Web SDK endpoint
  // (`viewer.sceneItems.listSceneItemMetadata`) — what the policy exposes.
  readonly restricted?: Metadata;
  // Stream = the raw render-frame metadata delivered inline with the raycaster
  // hit (`toMetadata({ hit })`). Only available after clicking an item.
  readonly stream?: Metadata;
  readonly status?: MetadataStatus;
  readonly error?: string;
  readonly diagnostic?: string;
}

// A row's classification given the currently VISIBLE source columns. "removed"
// is the prominent case (the policy stripped a key that the unrestricted source
// still exposes) and only applies when both those columns are visible.
export type CompareState = 'same' | 'differs' | 'removed';

export interface CompareRow {
  readonly key: string;
  // Value per source, keyed by source id (undefined when absent/empty).
  readonly values: Partial<Record<SourceId, string | undefined>>;
  readonly state: CompareState;
  // Structural identifier keys are informational and never flagged.
  readonly identifier: boolean;
}

// Accessible, non-color-only label for each highlighted row state.
const StateLabel: Record<CompareState, string> = {
  same: 'Same',
  differs: 'Differs',
  removed: 'Removed by policy',
};

// MUI palette cues per state. `same` stays neutral; `removed` is the prominent
// error case since the policy stripped the key, `differs` uses a subtler tint.
function stateBackground(state: CompareState): string | undefined {
  switch (state) {
    case 'removed':
      return 'error.light';
    case 'differs':
      return 'warning.light';
    default:
      return undefined;
  }
}

// A value is "present" when the key exists and its value is a non-empty string.
function isPresent(value?: string): boolean {
  return value != null && value !== '';
}

function sourceMetadata(
  id: SourceId,
  sources: { unrestricted?: Metadata; restricted?: Metadata; stream?: Metadata }
): Metadata | undefined {
  switch (id) {
    case 'unrestricted':
      return sources.unrestricted;
    case 'restricted':
      return sources.restricted;
    case 'stream':
      return sources.stream;
  }
}

// Build one comparison row per key across the union of the SELECTED sources
// (alphabetical, case-sensitive so `Material` !== `material`). Synthetic
// identifier keys are structural — always classified as "same" so they never
// produce false "removed by policy" or "differs" noise.
export function buildCompareRows({
  columns,
  unrestricted,
  restricted,
  stream,
}: {
  columns: readonly SourceId[];
  unrestricted?: Metadata;
  restricted?: Metadata;
  stream?: Metadata;
}): CompareRow[] {
  const sources = { unrestricted, restricted, stream };
  const propsByColumn = columns.map((id) => ({
    id,
    props: sourceMetadata(id, sources)?.properties ?? {},
  }));

  const keys = Array.from(
    new Set(propsByColumn.flatMap(({ props }) => Object.keys(props)))
  ).sort((a, b) => a.localeCompare(b));

  const unrestrictedVisible = columns.includes('unrestricted');
  const restrictedVisible = columns.includes('restricted');

  return keys.map((key) => {
    const values: Partial<Record<SourceId, string | undefined>> = {};
    propsByColumn.forEach(({ id, props }) => {
      values[id] = props[key];
    });
    const identifier = IdentifierKeys.has(key);

    if (identifier) {
      return { key, values, state: 'same', identifier };
    }

    // Prominent case: both policy-comparison columns visible and the key is
    // present unrestricted but absent/empty restricted -> policy stripped it.
    if (
      unrestrictedVisible &&
      restrictedVisible &&
      isPresent(values.unrestricted) &&
      !isPresent(values.restricted)
    ) {
      return { key, values, state: 'removed', identifier };
    }

    // Otherwise flag when the values across the visible columns are not all
    // equal (present/absent/value mismatch).
    const visibleValues = columns.map((id) => values[id]);
    const allEqual = visibleValues.every((v) => v === visibleValues[0]);

    return {
      key,
      values,
      state: allEqual ? 'same' : 'differs',
      identifier,
    };
  });
}

// Human-readable summary of the comparison. When both policy columns are
// visible, keys the policy stripped are the headline case, but keys that exist
// in every visible column with DIFFERING values must still be surfaced rather
// than reported as "No differences" (removed/differs are disjoint per row).
function summarizeComparison({
  comparingPolicy,
  removedCount,
  differsCount,
}: {
  comparingPolicy: boolean;
  removedCount: number;
  differsCount: number;
}): string {
  const parts: string[] = [];
  if (comparingPolicy && removedCount > 0) {
    parts.push(
      removedCount === 1
        ? '1 property removed by policy'
        : `${removedCount} properties removed by policy`
    );
  }
  if (differsCount > 0) {
    parts.push(differsCount === 1 ? '1 difference' : `${differsCount} differences`);
  }
  return parts.length === 0 ? 'No differences' : parts.join(', ');
}

function readStoredColumns(): SourceId[] {
  if (typeof window === 'undefined') return [...DefaultColumns];
  const raw = window.localStorage.getItem(ColumnsStorageKey);
  if (raw == null) return [...DefaultColumns];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      const valid = Sources.map((s) => s.id).filter((id) => parsed.includes(id));
      if (valid.length > 0) return valid;
    }
  } catch {
    // Ignore malformed storage and fall back to the default.
  }
  return [...DefaultColumns];
}

export function MetadataCompare({
  unrestricted,
  unrestrictedError,
  restricted,
  stream,
  status = 'ready',
  error,
  diagnostic,
}: Props): JSX.Element {
  // SSR-safe: first render uses the default so server/client markup match, then
  // the persisted selection is restored after mount.
  const [columns, setColumns] = React.useState<SourceId[]>([...DefaultColumns]);
  const [infoColumn, setInfoColumn] = React.useState<SourceId | null>(null);

  React.useEffect(() => {
    setColumns(readStoredColumns());
  }, []);

  function handleColumnsChange(
    _event: React.MouseEvent<HTMLElement>,
    next: SourceId[]
  ): void {
    // Never allow zero source columns; block deselecting the last one.
    if (next.length === 0) return;
    // Keep the fixed source order regardless of toggle interaction order.
    const ordered = Sources.map((s) => s.id).filter((id) => next.includes(id));
    setColumns(ordered);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ColumnsStorageKey, JSON.stringify(ordered));
    }
  }

  const toggle = (
    <ToggleButtonGroup
      aria-label="Metadata source columns"
      color="primary"
      onChange={handleColumnsChange}
      size="small"
      sx={{ mx: 2, my: 1 }}
      value={columns}
    >
      {Sources.map((s) => (
        <ToggleButton key={s.id} value={s.id} sx={{ textTransform: 'none' }}>
          {s.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );

  if (status === 'loading') return <StateMessage message="Loading metadata..." />;
  if (status === 'error') {
    return <StateMessage message={error ?? 'Failed to load metadata.'} error />;
  }

  const visibleSources = Sources.filter((s) => columns.includes(s.id));
  const rows = buildCompareRows({ columns, unrestricted, restricted, stream });

  const comparingPolicy =
    columns.includes('unrestricted') && columns.includes('restricted');
  const streamVisible = columns.includes('stream');
  const streamAvailable = stream != null;
  // When the unrestricted column is shown but its baseline failed to load, the
  // comparison has no ground truth for what a policy removed — warn instead of
  // reporting a (misleading) difference summary.
  const baselineMissing = columns.includes('unrestricted') && Boolean(unrestrictedError);

  if (rows.length === 0) {
    // With no rows we still show the toggle + any stream note so the user can
    // adjust columns; a fully empty ready state falls back to NoData.
    if (!streamVisible || streamAvailable) return <NoData />;
    return (
      <>
        <DrawerTitle />
        {toggle}
        <StreamNote />
        <NoData />
      </>
    );
  }

  const removedCount = rows.filter((r) => r.state === 'removed').length;
  const differsCount = rows.filter((r) => r.state === 'differs').length;

  const summary = summarizeComparison({
    comparingPolicy,
    removedCount,
    differsCount,
  });

  return (
    <>
      <DrawerTitle />
      {toggle}
      {diagnostic ? (
        <Typography
          role="status"
          sx={{ color: 'warning.main', mx: 2, my: 1 }}
          variant="caption"
        >
          {diagnostic}
        </Typography>
      ) : null}
      {streamVisible && !streamAvailable ? <StreamNote /> : null}
      {baselineMissing ? (
        <Typography
          role="status"
          sx={{ color: 'warning.main', display: 'block', mx: 2, my: 1 }}
          variant="caption"
        >
          Unrestricted baseline unavailable — cannot determine what the policy removed.
        </Typography>
      ) : (
        <Typography
          role="status"
          sx={{ color: 'text.secondary', display: 'block', mx: 2, my: 1 }}
          variant="caption"
        >
          {summary}
        </Typography>
      )}
      <TableContainer sx={{ flexGrow: 1 }}>
        <Table sx={{ whiteSpace: 'nowrap', tableLayout: 'fixed' }} size="small">
          <TableHead>
            <TableRow>
              <TableCell>
                <Typography variant="subtitle2">Key</Typography>
              </TableCell>
              {visibleSources.map((s) => (
                <TableCell key={s.id}>
                  <Typography
                    variant="subtitle2"
                    component="span"
                    sx={{ verticalAlign: 'middle' }}
                  >
                    {s.label}
                  </Typography>
                  <IconButton
                    aria-label={`About the ${s.label} column`}
                    onClick={() => setInfoColumn(s.id)}
                    size="small"
                    sx={{ ml: 0.5, verticalAlign: 'middle' }}
                  >
                    <HelpOutlineIcon fontSize="inherit" />
                  </IconButton>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <CompareTableRow key={row.key} row={row} columns={columns} />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <ColumnInfoDialog column={infoColumn} onClose={() => setInfoColumn(null)} />
    </>
  );
}

// Dialog explaining where a column's data is derived from.
function ColumnInfoDialog({
  column,
  onClose,
}: {
  readonly column: SourceId | null;
  readonly onClose: () => void;
}): JSX.Element {
  const info = column != null ? ColumnInfoMap[column] : null;
  return (
    <Dialog open={column != null} onClose={onClose}>
      <DialogTitle>{info?.title ?? ''}</DialogTitle>
      <DialogContent>
        <Typography variant="body2">{info?.body}</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

// Subtle note shown when the Stream column is visible but no hit-carried
// metadata exists for the current selection (e.g. selecting from the tree).
function StreamNote(): JSX.Element {
  return (
    <Typography
      role="status"
      sx={{ color: 'text.secondary', display: 'block', mx: 2, my: 1 }}
      variant="caption"
    >
      Stream metadata appears only when clicking an item in the viewer.
    </Typography>
  );
}

function CompareTableRow({
  row,
  columns,
}: {
  readonly row: CompareRow;
  readonly columns: readonly SourceId[];
}): JSX.Element {
  // Identifier keys are informational; never highlight them.
  const highlighted = !row.identifier && row.state !== 'same';
  const bg = highlighted ? stateBackground(row.state) : undefined;

  return (
    <TableRow
      data-state={row.state}
      data-identifier={row.identifier ? 'true' : undefined}
      sx={bg ? { backgroundColor: bg } : undefined}
    >
      <TableCell>
        <Typography
          sx={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          variant="subtitle2"
        >
          {row.key}
        </Typography>
        {highlighted ? (
          // Accessible marker so state is not conveyed by color alone.
          <Typography
            sx={{ color: 'text.secondary', display: 'block' }}
            variant="caption"
          >
            {StateLabel[row.state]}
          </Typography>
        ) : null}
      </TableCell>
      {columns.map((id) => (
        <ValueCell key={id} value={row.values[id]} />
      ))}
    </TableRow>
  );
}

function ValueCell({ value }: { readonly value?: string }): JSX.Element {
  const display = value != null && value !== '' ? value : '—';
  return (
    <TableCell>
      <Tooltip title={value ?? ''} placement="left" enterDelay={500}>
        <Typography
          sx={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          variant="body2"
        >
          {display}
        </Typography>
      </Tooltip>
    </TableCell>
  );
}
