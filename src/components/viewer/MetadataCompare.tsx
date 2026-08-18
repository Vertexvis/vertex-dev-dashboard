import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import {
  Box,
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
import { DrawerTitle, MetadataStatus, StateMessage } from './MetadataStates';

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
}

interface IdentityRow {
  readonly key: string;
  readonly label: string;
  readonly value: string;
}

const IdentityLabels: Readonly<Record<string, string>> = {
  VERTEX_SCENE_ITEM_ID: 'Scene item ID',
  VERTEX_SCENE_ITEM_SUPPLIED_ID: 'Scene item supplied ID',
  VERTEX_PART_ID: 'Part ID',
  VERTEX_PART_REVISION_ID: 'Part revision ID',
  VERTEX_PART_REVISION_SUPPLIED_ID: 'Part revision supplied ID',
};

// Accessible, non-color-only label for each highlighted row state.
const StateLabel: Record<CompareState, string> = {
  same: 'Same',
  differs: 'Differs',
  removed: 'Removed by policy',
};

interface LegendEntry {
  readonly state: CompareState;
  readonly label: string;
  readonly description: string;
}

// Keep the compact panel legend and the detailed dialog legend sourced from
// the same state descriptions so their color meanings cannot drift apart.
const LegendEntries: readonly LegendEntry[] = [
  {
    state: 'same',
    label: 'Same (no highlight)',
    description: 'Values match across selected columns.',
  },
  {
    state: 'differs',
    label: 'Differs (orange)',
    description: 'Values differ across selected columns.',
  },
  {
    state: 'removed',
    label: 'Removed by policy (red)',
    description:
      'With Unrestricted and Restricted selected, the property exists in Unrestricted but is missing or empty in Restricted.',
  },
];

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

// Build one comparison row per ordinary metadata key across the union of the
// SELECTED sources (alphabetical, case-sensitive so `Material` !== `material`).
// Structural identifier keys render in the separate Identity table instead.
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
  )
    .filter((key) => !IdentifierKeys.has(key))
    .sort((a, b) => a.localeCompare(b));

  const unrestrictedVisible = columns.includes('unrestricted');
  const restrictedVisible = columns.includes('restricted');

  return keys.map((key) => {
    const values: Partial<Record<SourceId, string | undefined>> = {};
    propsByColumn.forEach(({ id, props }) => {
      values[id] = props[key];
    });
    // Prominent case: both policy-comparison columns visible and the key is
    // present unrestricted but absent/empty restricted -> policy stripped it.
    if (
      unrestrictedVisible &&
      restrictedVisible &&
      isPresent(values.unrestricted) &&
      !isPresent(values.restricted)
    ) {
      return { key, values, state: 'removed' };
    }

    // Otherwise flag when the values across the visible columns are not all
    // equal (present/absent/value mismatch).
    // Missing and empty values both render as an em dash, so normalize them for
    // the generic comparison. The removed-by-policy check above intentionally
    // keeps its stronger Unrestricted-present/Restricted-empty precedence.
    const visibleValues = columns.map((id) =>
      isPresent(values[id]) ? values[id] : undefined
    );
    const allEqual = visibleValues.every((v) => v === visibleValues[0]);

    return {
      key,
      values,
      state: allEqual ? 'same' : 'differs',
    };
  });
}

// Identity values are structural context rather than policy-governed metadata.
// Prefer the policy-aware response, then a viewer hit, then the unrestricted
// response; later sources fill only identifiers unavailable from earlier ones.
function buildIdentityRows({
  unrestricted,
  restricted,
  stream,
}: {
  unrestricted?: Metadata;
  restricted?: Metadata;
  stream?: Metadata;
}): IdentityRow[] {
  const propertiesByPriority = [restricted, stream, unrestricted].map(
    (metadata) => metadata?.properties ?? {}
  );

  return Array.from(IdentifierKeys).flatMap((key) => {
    const value = propertiesByPriority
      .map((properties) => properties[key])
      .find(isPresent);
    return value == null ? [] : [{ key, label: IdentityLabels[key] ?? key, value }];
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
}: Props): JSX.Element {
  // SSR-safe: first render uses the default so server/client markup match, then
  // the persisted selection is restored after mount.
  const [columns, setColumns] = React.useState<SourceId[]>([...DefaultColumns]);
  const [infoColumn, setInfoColumn] = React.useState<SourceId | null>(null);
  const [columnsInfoOpen, setColumnsInfoOpen] = React.useState(false);

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

  const controls = (
    <>
      <Box sx={{ alignItems: 'center', display: 'flex', mx: 1.5, my: 1 }}>
        <ToggleButtonGroup
          aria-label="Metadata source columns"
          color="primary"
          onChange={handleColumnsChange}
          size="small"
          value={columns}
        >
          {Sources.map((s) => (
            <ToggleButton
              key={s.id}
              value={s.id}
              sx={{ px: 0.75, textTransform: 'none' }}
            >
              {s.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <IconButton
          aria-label="About properties column selection"
          onClick={() => setColumnsInfoOpen(true)}
          size="small"
          sx={{ ml: 0.5 }}
        >
          <HelpOutlineIcon fontSize="inherit" />
        </IconButton>
      </Box>
      <RowColorLegend />
    </>
  );

  if (status === 'loading') return <StateMessage message="Loading metadata..." />;
  if (status === 'error') {
    return <StateMessage message={error ?? 'Failed to load metadata.'} error />;
  }

  const visibleSources = Sources.filter((s) => columns.includes(s.id));
  const rows = buildCompareRows({ columns, unrestricted, restricted, stream });
  const identityRows = buildIdentityRows({ unrestricted, restricted, stream });

  const comparingPolicy =
    columns.includes('unrestricted') && columns.includes('restricted');
  const streamVisible = columns.includes('stream');
  const streamAvailable = stream != null;
  // When the unrestricted column is shown but its baseline failed to load, the
  // comparison has no ground truth for what a policy removed — warn instead of
  // reporting a (misleading) difference summary.
  const baselineMissing = columns.includes('unrestricted') && Boolean(unrestrictedError);

  if (rows.length === 0) {
    // Keep the controls and their help available even when the selected sources
    // have no rows to display.
    return (
      <>
        <DrawerTitle />
        <IdentityTable rows={identityRows} />
        {controls}
        {streamVisible && !streamAvailable ? <StreamNote /> : null}
        <EmptyMetadataState />
        <PropertiesColumnsInfoDialog
          open={columnsInfoOpen}
          onClose={() => setColumnsInfoOpen(false)}
        />
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
      <IdentityTable rows={identityRows} />
      {controls}
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
      <PropertiesColumnsInfoDialog
        open={columnsInfoOpen}
        onClose={() => setColumnsInfoOpen(false)}
      />
    </>
  );
}

function EmptyMetadataState(): JSX.Element {
  return (
    <Box
      sx={{
        alignItems: 'center',
        display: 'flex',
        flexGrow: 1,
        justifyContent: 'center',
      }}
    >
      <Typography sx={{ mx: 2, mb: 2 }} variant="body2">
        No data
      </Typography>
    </Box>
  );
}

function IdentityTable({
  rows,
}: {
  readonly rows: readonly IdentityRow[];
}): JSX.Element | null {
  if (rows.length === 0) return null;

  return (
    <TableContainer sx={{ flex: '0 0 auto', px: 1.5, pt: 1 }}>
      <Typography variant="subtitle2">Identity</Typography>
      <Table aria-label="Item identity" size="small">
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell sx={{ pl: 0 }}>
                <Typography variant="subtitle2">{row.label}</Typography>
              </TableCell>
              <ValueCell value={row.value} />
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function RowColorLegend({
  detailed = false,
}: {
  readonly detailed?: boolean;
}): JSX.Element {
  return (
    <Box
      aria-label="Row color legend"
      role="group"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        mx: detailed ? 0 : 2,
        my: 1,
      }}
    >
      {LegendEntries.map(({ state, label, description }) => (
        <Box key={state} sx={{ alignItems: 'flex-start', display: 'flex', gap: 0.75 }}>
          <Box
            aria-hidden="true"
            data-legend-state={state}
            sx={{
              backgroundColor: stateBackground(state) ?? 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              flex: '0 0 auto',
              height: 12,
              mt: 0.25,
              width: 12,
            }}
          />
          <Typography variant="caption">
            <Box component="span" sx={{ fontWeight: 'fontWeightMedium' }}>
              {label}
            </Box>
            {detailed ? ` — ${description}` : null}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

function PropertiesColumnsInfoDialog({
  open,
  onClose,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
}): JSX.Element {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Properties column selection</DialogTitle>
      <DialogContent>
        <Typography paragraph variant="body2">
          Choose which metadata sources to compare. The table shows one row for every
          property key found in at least one selected source, and each selected column
          shows that source&apos;s value.
        </Typography>
        <Box component="ul" sx={{ mt: 0, pl: 2.5 }}>
          <Typography component="li" variant="body2">
            <strong>Unrestricted:</strong> Complete metadata without a property key
            policy.
          </Typography>
          <Typography component="li" variant="body2">
            <strong>Restricted:</strong> Metadata exposed through the currently selected
            property key policy.
          </Typography>
          <Typography component="li" variant="body2">
            <strong>Stream:</strong> Metadata returned with a viewer click; it is
            unavailable for scene-tree selections.
          </Typography>
        </Box>
        <Typography paragraph variant="body2">
          An em dash (—) means the source has no value for that key or the value is empty.
          At least one column remains selected, and your selection is saved in this
          browser.
        </Typography>
        <Typography variant="subtitle2">Row colors</Typography>
        <RowColorLegend detailed />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
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
  const highlighted = row.state !== 'same';
  const bg = highlighted ? stateBackground(row.state) : undefined;

  return (
    <TableRow data-state={row.state} sx={bg ? { backgroundColor: bg } : undefined}>
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
