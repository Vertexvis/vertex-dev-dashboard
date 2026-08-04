import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';

import { MetadataStatus } from '../../../components/viewer/MetadataStates';
import { RightDrawer } from '../../../components/viewer/RightDrawer';
import { Metadata } from '../../../lib/metadata';
import { ModelViewsState } from '../../../lib/model-views';
import { loadItemMetadata } from '../../../pages/scene-viewer/[sceneId]';

type Controller = Parameters<typeof loadItemMetadata>[0]['controller'];

const emptyModelViews: ModelViewsState = {
  modelViewList: [],
  annotationList: [],
  actions: {
    fetchNextModelViews: jest.fn(),
    loadModelView: jest.fn(),
    unloadModelView: jest.fn(),
    fetchNextAnnotations: jest.fn(),
  },
};

function renderCompare(props: {
  metadata?: Metadata;
  unrestrictedMetadata?: Metadata;
  unrestrictedError?: boolean;
  streamMetadata?: Metadata;
  metadataStatus?: MetadataStatus;
  metadataError?: string;
  metadataDiagnostic?: string;
}): ReturnType<typeof render> {
  return render(
    <RightDrawer
      active="properties"
      modelViews={emptyModelViews}
      onViewStateSelected={jest.fn()}
      {...props}
    />
  );
}

// Return the table row (<tr>) that contains the given key text.
function rowForKey(key: string): HTMLElement {
  const cell = screen.getByText(key).closest('tr');
  if (cell == null) throw new Error(`No row found for key ${key}`);
  return cell as HTMLElement;
}

// The visible column header labels (excluding the always-present Key column).
function sourceColumnHeaders(): string[] {
  const headerRow = screen.getAllByRole('row')[0];
  return within(headerRow)
    .getAllByRole('columnheader')
    .map((c) => c.textContent ?? '')
    .filter((label) => label !== 'Key');
}

// The source toggle button for a given label.
function toggleButton(label: string): HTMLElement {
  return screen.getByRole('button', { name: label });
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('MetadataCompare column toggle + defaults', () => {
  it('defaults to Unrestricted + Restricted columns (no Stream), with a Key column', () => {
    renderCompare({
      metadataStatus: 'ready',
      unrestrictedMetadata: {
        partName: 'Bracket',
        properties: { Material: 'Steel' },
      },
      metadata: { partName: 'Bracket', properties: { Material: 'Steel' } },
    });

    expect(sourceColumnHeaders()).toEqual(['Unrestricted', 'Restricted']);
    // Key column always present.
    const headerRow = screen.getAllByRole('row')[0];
    expect(
      within(headerRow).getByRole('columnheader', { name: 'Key' })
    ).toBeInTheDocument();
  });

  it('toggling Stream on renders the third column and its values', () => {
    renderCompare({
      metadataStatus: 'ready',
      unrestrictedMetadata: {
        partName: '',
        properties: { Material: 'Steel' },
      },
      metadata: { partName: '', properties: { Material: 'Steel' } },
      streamMetadata: { partName: '', properties: { Material: 'StreamSteel' } },
    });

    expect(sourceColumnHeaders()).toEqual(['Unrestricted', 'Restricted']);

    fireEvent.click(toggleButton('Stream'));

    expect(sourceColumnHeaders()).toEqual(['Unrestricted', 'Restricted', 'Stream']);
    // The stream value renders in its column.
    expect(within(rowForKey('Material')).getByText('StreamSteel')).toBeInTheDocument();
  });

  it('toggling a source off removes its column', () => {
    renderCompare({
      metadataStatus: 'ready',
      unrestrictedMetadata: {
        partName: '',
        properties: { Material: 'Steel' },
      },
      metadata: { partName: '', properties: { Material: 'Steel' } },
    });

    fireEvent.click(toggleButton('Unrestricted'));

    expect(sourceColumnHeaders()).toEqual(['Restricted']);
  });

  it('cannot deselect the last remaining source column', () => {
    renderCompare({
      metadataStatus: 'ready',
      metadata: { partName: '', properties: { Material: 'Steel' } },
    });

    // Turn off Unrestricted, leaving only Restricted.
    fireEvent.click(toggleButton('Unrestricted'));
    expect(sourceColumnHeaders()).toEqual(['Restricted']);

    // Attempting to turn off the last one is blocked.
    fireEvent.click(toggleButton('Restricted'));
    expect(sourceColumnHeaders()).toEqual(['Restricted']);
  });
});

describe('MetadataCompare persistence', () => {
  it('writes the selection to localStorage when toggled', () => {
    renderCompare({
      metadataStatus: 'ready',
      metadata: { partName: '', properties: { Material: 'Steel' } },
      streamMetadata: { partName: '', properties: { Material: 'Steel' } },
    });

    fireEvent.click(toggleButton('Stream'));

    expect(
      JSON.parse(window.localStorage.getItem('viewer.metadataColumns') ?? '[]')
    ).toEqual(['unrestricted', 'restricted', 'stream']);
  });

  it('reads the persisted selection from localStorage on mount', async () => {
    window.localStorage.setItem(
      'viewer.metadataColumns',
      JSON.stringify(['restricted', 'stream'])
    );

    renderCompare({
      metadataStatus: 'ready',
      metadata: { partName: '', properties: { Material: 'Steel' } },
      streamMetadata: { partName: '', properties: { Material: 'Steel' } },
    });

    // The persisted selection is applied after mount, in fixed source order.
    await waitFor(() => expect(sourceColumnHeaders()).toEqual(['Restricted', 'Stream']));
  });
});

describe('MetadataCompare diff highlighting', () => {
  it('classifies an equal key as same and does not flag it', () => {
    renderCompare({
      metadataStatus: 'ready',
      unrestrictedMetadata: {
        partName: 'Bracket',
        properties: { Material: 'Steel' },
      },
      metadata: { partName: 'Bracket', properties: { Material: 'Steel' } },
    });

    const row = rowForKey('Material');
    expect(row).toHaveAttribute('data-state', 'same');
    expect(within(row).queryByText('Differs')).not.toBeInTheDocument();
    expect(within(row).queryByText('Removed by policy')).not.toBeInTheDocument();
    expect(screen.getByText('No differences')).toBeInTheDocument();
  });

  it('flags a key stripped by the policy as removed (both columns visible)', () => {
    renderCompare({
      metadataStatus: 'ready',
      unrestrictedMetadata: {
        partName: '',
        properties: { Material: 'Steel', Cost: '100' },
      },
      // Policy stripped "Cost".
      metadata: { partName: '', properties: { Material: 'Steel' } },
    });

    const row = rowForKey('Cost');
    expect(row).toHaveAttribute('data-state', 'removed');
    expect(within(row).getByText('Removed by policy')).toBeInTheDocument();
    // Unrestricted shows the value; restricted shows the em-dash placeholder.
    expect(within(row).getByText('100')).toBeInTheDocument();
    expect(within(row).getByText('—')).toBeInTheDocument();
    expect(screen.getByText('1 property removed by policy')).toBeInTheDocument();
  });

  it('treats an empty restricted value as removed by policy', () => {
    renderCompare({
      metadataStatus: 'ready',
      unrestrictedMetadata: { partName: '', properties: { Cost: '100' } },
      metadata: { partName: '', properties: { Cost: '' } },
    });

    expect(rowForKey('Cost')).toHaveAttribute('data-state', 'removed');
    expect(screen.getByText('1 property removed by policy')).toBeInTheDocument();
  });

  it('flags differing values across visible columns as differs', () => {
    renderCompare({
      metadataStatus: 'ready',
      unrestrictedMetadata: {
        partName: '',
        properties: { Material: 'Steel' },
      },
      metadata: { partName: '', properties: { Material: 'Aluminum' } },
    });

    const row = rowForKey('Material');
    expect(row).toHaveAttribute('data-state', 'differs');
    expect(within(row).getByText('Differs')).toBeInTheDocument();
    // A differing value (present in both columns) is not "removed by policy",
    // but it IS a difference — the summary must surface it, not report none.
    expect(screen.getByText('1 difference')).toBeInTheDocument();
  });

  it('reports both removed and differing keys in the policy summary', () => {
    renderCompare({
      metadataStatus: 'ready',
      unrestrictedMetadata: {
        partName: '',
        properties: { Material: 'Steel', Cost: '100' },
      },
      // Cost stripped by policy (removed); Material present but changed (differs).
      metadata: { partName: '', properties: { Material: 'Aluminum' } },
    });

    expect(rowForKey('Cost')).toHaveAttribute('data-state', 'removed');
    expect(rowForKey('Material')).toHaveAttribute('data-state', 'differs');
    expect(
      screen.getByText('1 property removed by policy, 1 difference')
    ).toBeInTheDocument();
  });

  it('counts and pluralizes multiple removed keys', () => {
    renderCompare({
      metadataStatus: 'ready',
      unrestrictedMetadata: {
        partName: '',
        properties: { Material: 'Steel', Cost: '100', Weight: '12kg' },
      },
      metadata: { partName: '', properties: { Material: 'Steel' } },
    });

    expect(rowForKey('Cost')).toHaveAttribute('data-state', 'removed');
    expect(rowForKey('Weight')).toHaveAttribute('data-state', 'removed');
    expect(rowForKey('Material')).toHaveAttribute('data-state', 'same');
    expect(screen.getByText('2 properties removed by policy')).toBeInTheDocument();
  });

  it('never flags synthetic identifier keys, even when absent on one side', () => {
    renderCompare({
      metadataStatus: 'ready',
      // Identifier present unrestricted but absent restricted (e.g. tree
      // selection) — must NOT be reported as removed by policy.
      unrestrictedMetadata: {
        partName: '',
        properties: {
          VERTEX_SCENE_ITEM_ID: 'item-1',
          VERTEX_PART_ID: 'part-1',
          Material: 'Steel',
        },
      },
      metadata: {
        partName: '',
        properties: { Material: 'Steel' },
      },
    });

    const idRow = rowForKey('VERTEX_SCENE_ITEM_ID');
    expect(idRow).toHaveAttribute('data-state', 'same');
    expect(idRow).toHaveAttribute('data-identifier', 'true');
    expect(within(idRow).queryByText('Removed by policy')).not.toBeInTheDocument();

    const partRow = rowForKey('VERTEX_PART_ID');
    expect(partRow).toHaveAttribute('data-state', 'same');

    // No false "removed" noise from identifier keys.
    expect(screen.getByText('No differences')).toBeInTheDocument();
  });

  it('keeps case-sensitive keys as distinct rows', () => {
    renderCompare({
      metadataStatus: 'ready',
      unrestrictedMetadata: {
        partName: '',
        properties: { Material: 'Steel', material: 'aluminum' },
      },
      metadata: {
        partName: '',
        properties: { Material: 'Steel', material: 'aluminum' },
      },
    });

    expect(rowForKey('Material')).toHaveAttribute('data-state', 'same');
    expect(rowForKey('material')).toHaveAttribute('data-state', 'same');
    // Distinct rows: neither folds into the other.
    expect(rowForKey('Material')).not.toBe(rowForKey('material'));
  });

  it('preserves alphabetical key order across the visible sources', () => {
    renderCompare({
      metadataStatus: 'ready',
      unrestrictedMetadata: {
        partName: '',
        properties: { Zeta: 'z', Alpha: 'a' },
      },
      metadata: { partName: '', properties: { Mu: 'm' } },
    });

    const keys = screen
      .getAllByRole('row')
      // Skip the header row (has no data-state).
      .filter((r) => r.getAttribute('data-state') != null)
      // The key cell may also contain an accessible state marker; read only the
      // key Typography (rendered with the subtitle2 variant).
      .map(
        (r) =>
          within(r).getAllByRole('cell')[0].querySelector('.MuiTypography-subtitle2')
            ?.textContent
      );

    expect(keys).toEqual(['Alpha', 'Mu', 'Zeta']);
  });
});

describe('MetadataCompare Stream column', () => {
  it('adds a Stream diff across three columns and a generic difference summary when policy pair is hidden', () => {
    window.localStorage.setItem(
      'viewer.metadataColumns',
      JSON.stringify(['restricted', 'stream'])
    );

    renderCompare({
      metadataStatus: 'ready',
      metadata: { partName: '', properties: { Material: 'Steel' } },
      streamMetadata: {
        partName: '',
        properties: { Material: 'StreamSteel' },
      },
    });

    const row = rowForKey('Material');
    expect(row).toHaveAttribute('data-state', 'differs');
    expect(within(row).getByText('Differs')).toBeInTheDocument();
    // With the Unrestricted/Restricted pair not both visible, the summary is
    // the generic difference count.
    expect(screen.getByText('1 difference')).toBeInTheDocument();
  });

  it('shows the click-an-item note and em-dash cells when Stream is visible without data', () => {
    renderCompare({
      metadataStatus: 'ready',
      unrestrictedMetadata: {
        partName: '',
        properties: { Material: 'Steel' },
      },
      metadata: { partName: '', properties: { Material: 'Steel' } },
      // No streamMetadata: tree selection has no render-frame hit.
    });

    fireEvent.click(toggleButton('Stream'));

    expect(
      screen.getByText(
        'Stream metadata appears only when clicking an item in the viewer.'
      )
    ).toBeInTheDocument();

    // The Stream column cell for the key shows the em-dash placeholder.
    const row = rowForKey('Material');
    const streamCell = within(row).getAllByRole('cell')[3];
    expect(within(streamCell).getByText('—')).toBeInTheDocument();
  });
});

describe('MetadataCompare column help icons and info dialog', () => {
  it('renders help icon buttons for each visible column header (default: Unrestricted + Restricted)', () => {
    renderCompare({
      metadataStatus: 'ready',
      unrestrictedMetadata: {
        partName: '',
        properties: { Material: 'Steel' },
      },
      metadata: { partName: '', properties: { Material: 'Steel' } },
    });

    expect(
      screen.getByRole('button', { name: 'About the Unrestricted column' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'About the Restricted column' })
    ).toBeInTheDocument();
    // Stream is not visible by default.
    expect(
      screen.queryByRole('button', { name: 'About the Stream column' })
    ).not.toBeInTheDocument();
  });

  it('shows the Stream help icon only when the Stream column is toggled on', () => {
    renderCompare({
      metadataStatus: 'ready',
      unrestrictedMetadata: {
        partName: '',
        properties: { Material: 'Steel' },
      },
      metadata: { partName: '', properties: { Material: 'Steel' } },
      streamMetadata: { partName: '', properties: { Material: 'StreamSteel' } },
    });

    expect(
      screen.queryByRole('button', { name: 'About the Stream column' })
    ).not.toBeInTheDocument();

    fireEvent.click(toggleButton('Stream'));

    expect(
      screen.getByRole('button', { name: 'About the Stream column' })
    ).toBeInTheDocument();
  });

  it('clicking the Unrestricted help icon opens a dialog with the correct title and body', () => {
    renderCompare({
      metadataStatus: 'ready',
      unrestrictedMetadata: {
        partName: '',
        properties: { Material: 'Steel' },
      },
      metadata: { partName: '', properties: { Material: 'Steel' } },
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'About the Unrestricted column' })
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Unrestricted metadata' })
    ).toBeInTheDocument();
    expect(screen.getByText(/\/api\/scene-items/)).toBeInTheDocument();
  });

  it('clicking the Restricted help icon opens a dialog mentioning listSceneItemMetadata', () => {
    renderCompare({
      metadataStatus: 'ready',
      unrestrictedMetadata: {
        partName: '',
        properties: { Material: 'Steel' },
      },
      metadata: { partName: '', properties: { Material: 'Steel' } },
    });

    fireEvent.click(screen.getByRole('button', { name: 'About the Restricted column' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Restricted metadata' })
    ).toBeInTheDocument();
    expect(screen.getByText(/listSceneItemMetadata/)).toBeInTheDocument();
  });

  it('clicking the Stream help icon opens a dialog mentioning hit.metadataProperties', () => {
    renderCompare({
      metadataStatus: 'ready',
      unrestrictedMetadata: {
        partName: '',
        properties: { Material: 'Steel' },
      },
      metadata: { partName: '', properties: { Material: 'Steel' } },
      streamMetadata: { partName: '', properties: { Material: 'StreamSteel' } },
    });

    fireEvent.click(toggleButton('Stream'));
    fireEvent.click(screen.getByRole('button', { name: 'About the Stream column' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Stream metadata' })).toBeInTheDocument();
    expect(screen.getByText(/hit\.metadataProperties/)).toBeInTheDocument();
  });

  it('closes the dialog when the Close button is clicked', async () => {
    renderCompare({
      metadataStatus: 'ready',
      unrestrictedMetadata: {
        partName: '',
        properties: { Material: 'Steel' },
      },
      metadata: { partName: '', properties: { Material: 'Steel' } },
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'About the Unrestricted column' })
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    // After closing the dialog title should no longer be visible.
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Unrestricted metadata' })
      ).not.toBeInTheDocument()
    );
  });
});

describe('MetadataCompare states', () => {
  it('shows a loading state while metadata is being fetched', () => {
    renderCompare({ metadataStatus: 'loading' });

    expect(screen.getByText('Loading metadata...')).toBeInTheDocument();
  });

  it('shows an error state (role=alert) when metadata loading fails', () => {
    renderCompare({
      metadataStatus: 'error',
      metadataError: 'Unable to load metadata for this item.',
    });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Unable to load metadata for this item.');
  });

  it('shows the No data state when the visible sources are empty and ready', () => {
    renderCompare({
      metadataStatus: 'ready',
      unrestrictedMetadata: { partName: '', properties: {} },
      metadata: { partName: '', properties: {} },
    });

    expect(screen.getByText('No data')).toBeInTheDocument();
  });

  it('renders the restricted keys even without an unrestricted source', () => {
    renderCompare({
      metadataStatus: 'ready',
      metadata: {
        partName: 'Bracket',
        properties: { Material: 'Steel', Cost: '100' },
      },
    });

    // With no unrestricted data, restricted-only keys differ across the visible
    // columns but are never falsely flagged as removed by policy.
    expect(rowForKey('Material')).toHaveAttribute('data-state', 'differs');
    expect(rowForKey('Cost')).toHaveAttribute('data-state', 'differs');
    expect(screen.queryByText(/removed by policy/)).not.toBeInTheDocument();
  });

  it('surfaces a subtle diagnostic without blocking the comparison', () => {
    renderCompare({
      metadataStatus: 'ready',
      unrestrictedMetadata: {
        partName: '',
        properties: { Material: 'Steel' },
      },
      metadata: { partName: '', properties: { Material: 'Steel' } },
      metadataDiagnostic: 'Policy applied, but no metadata was returned.',
    });

    expect(
      screen.getByText('Policy applied, but no metadata was returned.')
    ).toBeInTheDocument();
    // Comparison still renders alongside the diagnostic.
    expect(rowForKey('Material')).toHaveAttribute('data-state', 'same');
  });

  it('warns instead of reporting no differences when the baseline fails', () => {
    renderCompare({
      metadataStatus: 'ready',
      // Unrestricted baseline failed to load; only restricted metadata is present.
      unrestrictedError: true,
      metadata: { partName: '', properties: { Material: 'Steel' } },
    });

    expect(screen.getByText(/Unrestricted baseline unavailable/)).toBeInTheDocument();
    // The (misleading) difference summary must not be shown in its place.
    expect(screen.queryByText('No differences')).not.toBeInTheDocument();
  });
});

describe('RightDrawer resize handle', () => {
  it('renders a vertical separator handle', () => {
    renderCompare({
      metadataStatus: 'ready',
      metadata: { partName: '', properties: { Material: 'Steel' } },
    });

    const handle = screen.getByRole('separator');
    expect(handle).toHaveAttribute('aria-orientation', 'vertical');
  });

  it('updates the drawer width on drag', () => {
    const { container } = renderCompare({
      metadataStatus: 'ready',
      metadata: { partName: '', properties: { Material: 'Steel' } },
    });

    // Wide viewport so the clamp does not swallow the change.
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1600,
    });

    // The chosen width is applied inline to the drawer paper.
    const paper = container.querySelector('.MuiDrawer-paper') as HTMLElement;
    const before = paper?.style.width;
    expect(before).toBe('320px');

    const handle = screen.getByRole('separator');
    fireEvent.mouseDown(handle, { clientX: 1280 });
    // Dragging the left edge 180px left grows the 320px drawer to 500px.
    fireEvent.mouseMove(document, { clientX: 1100 });
    fireEvent.mouseUp(document);

    const after = (container.querySelector('.MuiDrawer-paper') as HTMLElement)?.style
      .width;

    // width should now be ~500px (1600 - 1100), and differ from the default.
    expect(after).not.toBe(before);
    expect(after).toBe('500px');
  });
});

// Minimal harness wiring the real metadata-loading path (via loadItemMetadata)
// to the visible panel, so a rejected Web SDK call actually drives the error UI
// rather than only asserting the helper rejects.
function MetadataLoadingHarness({ controller }: { controller: Controller }): JSX.Element {
  const [status, setStatus] = React.useState<MetadataStatus>('loading');
  const [error, setError] = React.useState<string>();

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await loadItemMetadata({
          controller,
          itemId: 'item-1',
          viewId: 'view-1',
        });
        if (!cancelled) setStatus('ready');
      } catch {
        if (cancelled) return;
        setStatus('error');
        setError('Unable to load metadata for this item.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [controller]);

  return (
    <RightDrawer
      active="properties"
      modelViews={emptyModelViews}
      onViewStateSelected={jest.fn()}
      metadataStatus={status}
      metadataError={error}
    />
  );
}

describe('MetadataCompare error path (Web SDK failure)', () => {
  it('shows the error alert when listSceneItemMetadata rejects', async () => {
    const controller = {
      listSceneItemMetadata: jest
        .fn()
        .mockRejectedValue(new Error('metadata unavailable')),
      getSceneViewItem: jest.fn(),
    } as unknown as Controller;

    render(<MetadataLoadingHarness controller={controller} />);

    const alert = await waitFor(() => screen.getByRole('alert'));
    expect(alert).toHaveTextContent('Unable to load metadata for this item.');
  });
});
