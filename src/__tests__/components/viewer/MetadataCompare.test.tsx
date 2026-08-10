import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { SceneItemData } from '@vertexvis/api-client-node';
import { http, HttpResponse } from 'msw';
import React from 'react';
import { useSWRConfig } from 'swr';

import { installJsdomMockServer } from '../../../../test/msw/installJsdomMockServer';
import { server } from '../../../../test/msw/server';
import { renderWithSWR } from '../../../../test/render/renderWithSWR';
import { MetadataStatus } from '../../../components/viewer/MetadataStates';
import { RightDrawer } from '../../../components/viewer/RightDrawer';
import { Metadata } from '../../../lib/metadata';
import { ModelViewsState } from '../../../lib/model-views';
import {
  loadItemMetadata,
  useMetadataPanelData,
} from '../../../pages/scene-viewer/[sceneId]';

type Controller = Parameters<typeof loadItemMetadata>[0]['controller'];

function stringEntry(
  id: string,
  name: string,
  value: string
): {
  id: string;
  key: { name: string; category: number };
  value: { type: string; value: string };
} {
  return {
    id,
    key: { name, category: 0 },
    value: { type: 'string', value },
  };
}

function sceneItem(id: string, material: string): SceneItemData {
  return {
    id,
    attributes: { metadata: { Material: { value: material } } },
    relationships: {},
  } as unknown as SceneItemData;
}

function deferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
} {
  const holder: { resolve?: (value: T) => void } = {};
  const promise = new Promise<T>((resolve) => {
    holder.resolve = resolve;
  });
  return {
    promise,
    resolve(value: T) {
      holder.resolve?.(value);
    },
  };
}

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

describe('MetadataCompare selector help and row legend', () => {
  it('shows an accessible help button beside the column selector and a text legend', () => {
    renderCompare({
      metadataStatus: 'ready',
      unrestrictedMetadata: {
        partName: '',
        properties: { Material: 'Steel', Cost: '100' },
      },
      metadata: { partName: '', properties: { Material: 'Aluminum' } },
    });

    const selector = screen.getByLabelText('Metadata source columns');
    const help = screen.getByRole('button', {
      name: 'About properties column selection',
    });
    expect(selector).not.toContainElement(help);
    expect(selector.parentElement).toContainElement(help);

    const legend = screen.getByRole('group', { name: 'Row color legend' });
    expect(within(legend).getByText('Same (no highlight)')).toBeInTheDocument();
    expect(within(legend).getByText('Differs (orange)')).toBeInTheDocument();
    expect(within(legend).getByText('Removed by policy (red)')).toBeInTheDocument();
    expect(legend.querySelector('[data-legend-state="same"]')).toBeInTheDocument();
    expect(legend.querySelector('[data-legend-state="differs"]')).toBeInTheDocument();
    expect(legend.querySelector('[data-legend-state="removed"]')).toBeInTheDocument();
  });

  it('explains the selected-source union, sources, missing values, persistence, and colors', () => {
    renderCompare({
      metadataStatus: 'ready',
      unrestrictedMetadata: {
        partName: '',
        properties: { Material: 'Steel' },
      },
      metadata: { partName: '', properties: { Material: 'Steel' } },
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'About properties column selection' })
    );

    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByRole('heading', { name: 'Properties column selection' })
    ).toBeInTheDocument();
    expect(dialog).toHaveTextContent(
      'one row for every property key found in at least one selected source'
    );
    expect(dialog).toHaveTextContent(
      'Unrestricted: Complete metadata without a property key policy.'
    );
    expect(dialog).toHaveTextContent(
      'Restricted: Metadata exposed through the currently selected property key policy.'
    );
    expect(dialog).toHaveTextContent(
      'Stream: Metadata returned with a viewer click; it is unavailable for scene-tree selections.'
    );
    expect(dialog).toHaveTextContent(
      'An em dash (—) means the source has no value for that key or the value is empty.'
    );
    expect(dialog).toHaveTextContent('your selection is saved in this browser');

    const legend = within(dialog).getByRole('group', { name: 'Row color legend' });
    expect(legend).toHaveTextContent(
      'Same (no highlight) — Values match across selected columns, or the row is an identifier.'
    );
    expect(legend).toHaveTextContent(
      'Differs (orange) — Values differ across selected columns.'
    );
    expect(legend).toHaveTextContent(
      'Removed by policy (red) — With Unrestricted and Restricted selected, the property exists in Unrestricted but is missing or empty in Restricted.'
    );
  });

  it('closes the properties column selection dialog', async () => {
    renderCompare({
      metadataStatus: 'ready',
      unrestrictedMetadata: { partName: '', properties: { Material: 'Steel' } },
      metadata: { partName: '', properties: { Material: 'Steel' } },
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'About properties column selection' })
    );
    expect(
      screen.getByRole('heading', { name: 'Properties column selection' })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Properties column selection' })
      ).not.toBeInTheDocument()
    );
  });

  it('keeps selector help and the legend available when ready metadata has no rows', () => {
    renderCompare({ metadataStatus: 'ready' });

    expect(screen.getByText('No data')).toBeInTheDocument();
    expect(screen.getAllByText('Properties')).toHaveLength(1);
    expect(screen.getByRole('group', { name: 'Row color legend' })).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'About properties column selection' })
    );
    expect(
      screen.getByRole('heading', { name: 'Properties column selection' })
    ).toBeInTheDocument();
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

  it('treats empty and missing values as the same rendered value', () => {
    renderCompare({
      metadataStatus: 'ready',
      unrestrictedMetadata: {
        partName: '',
        properties: { Optional: '' },
      },
      metadata: { partName: '', properties: {} },
    });

    const row = rowForKey('Optional');
    expect(row).toHaveAttribute('data-state', 'same');
    expect(within(row).getAllByText('—')).toHaveLength(2);
    expect(within(row).queryByText('Differs')).not.toBeInTheDocument();
    expect(screen.getByText('No differences')).toBeInTheDocument();
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

function CoordinatedMetadataHarness({
  itemId,
  controller,
}: {
  readonly itemId: string;
  readonly controller: Controller;
}): JSX.Element {
  const { mutate } = useSWRConfig();
  const panel = useMetadataPanelData({
    selectedItemId: itemId,
    viewId: 'view-1',
    controller,
  });

  return (
    <>
      <button
        onClick={() => {
          void mutate(`/api/scene-items/${itemId}`);
        }}
      >
        Refresh unrestricted metadata
      </button>
      <RightDrawer
        active="properties"
        metadata={panel.metadata}
        unrestrictedMetadata={panel.unrestrictedMetadata}
        unrestrictedError={panel.unrestrictedError}
        metadataStatus={panel.status}
        metadataError={panel.error}
        metadataDiagnostic={panel.diagnostic}
        modelViews={emptyModelViews}
        onViewStateSelected={jest.fn()}
      />
    </>
  );
}

describe('MetadataCompare coordinated source loading', () => {
  installJsdomMockServer();

  it('keeps loading through a selection change until both sources match the new item', async () => {
    const unrestrictedB = deferred<SceneItemData>();
    const restrictedB = deferred<{
      paging: Record<string, never>;
      entries: ReturnType<typeof stringEntry>[];
    }>();
    server.use(
      http.get('*/api/scene-items/:id', async ({ params }) => {
        const itemId = String(params.id);
        const item =
          itemId === 'item-a'
            ? sceneItem(itemId, 'Steel A')
            : await unrestrictedB.promise;
        return HttpResponse.json(item);
      })
    );
    const listSceneItemMetadata = jest.fn((itemId: string) =>
      itemId === 'item-a'
        ? Promise.resolve({
            paging: {},
            entries: [stringEntry('entry-a', 'Material', 'Steel A')],
          })
        : restrictedB.promise
    );
    const getSceneViewItem = jest.fn((itemId: string) =>
      Promise.resolve({ id: itemId, name: itemId })
    );
    const controller = {
      listSceneItemMetadata,
      getSceneViewItem,
    } as unknown as Controller;

    const result = renderWithSWR(
      <CoordinatedMetadataHarness itemId="item-a" controller={controller} />
    );
    await waitFor(() =>
      expect(rowForKey('Material')).toHaveAttribute('data-state', 'same')
    );

    result.rerender(
      <CoordinatedMetadataHarness itemId="item-b" controller={controller} />
    );

    // The request identity changes during render, before the loading effect can
    // run, so stale item A rows never reach the comparison table.
    expect(screen.getByText('Loading metadata...')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('Steel A')).not.toBeInTheDocument();

    await act(async () => {
      restrictedB.resolve({
        paging: {},
        entries: [stringEntry('entry-b', 'Material', 'Steel B')],
      });
      await restrictedB.promise;
    });
    await waitFor(() =>
      expect(getSceneViewItem).toHaveBeenCalledWith('item-b', 'view-1', {})
    );

    // Restricted data alone is not a complete comparison. In particular, it
    // must not render temporary warning-colored rows against a missing baseline.
    expect(screen.getByText('Loading metadata...')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    await act(async () => {
      unrestrictedB.resolve(sceneItem('item-b', 'Steel B'));
      await unrestrictedB.promise;
    });

    await waitFor(() =>
      expect(rowForKey('Material')).toHaveAttribute('data-state', 'same')
    );
    expect(screen.getAllByText('Steel B')).toHaveLength(2);
  });

  it('treats an unrestricted-source error as settled instead of loading forever', async () => {
    server.use(
      http.get('*/api/scene-items/:id', () =>
        HttpResponse.json({ message: 'Unavailable' }, { status: 503 })
      )
    );
    const controller = {
      listSceneItemMetadata: jest.fn().mockResolvedValue({
        paging: {},
        entries: [stringEntry('entry-1', 'Material', 'Steel')],
      }),
      getSceneViewItem: jest.fn().mockResolvedValue({ id: 'item-error', name: 'Item' }),
    } as unknown as Controller;

    renderWithSWR(
      <CoordinatedMetadataHarness itemId="item-error" controller={controller} />
    );

    expect(screen.getByText('Loading metadata...')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText(/Unrestricted baseline unavailable/)).toBeInTheDocument()
    );
    expect(rowForKey('Material')).toBeInTheDocument();
    expect(screen.queryByText('Loading metadata...')).not.toBeInTheDocument();
  });

  it('keeps complete cached results visible during unrestricted revalidation', async () => {
    const refresh = deferred<SceneItemData>();
    const requestCount = { current: 0 };
    server.use(
      http.get('*/api/scene-items/:id', async () => {
        requestCount.current += 1;
        const item =
          requestCount.current === 1
            ? sceneItem('item-1', 'Steel')
            : await refresh.promise;
        return HttpResponse.json(item);
      })
    );
    const controller = {
      listSceneItemMetadata: jest.fn().mockResolvedValue({
        paging: {},
        entries: [stringEntry('entry-1', 'Material', 'Steel')],
      }),
      getSceneViewItem: jest.fn().mockResolvedValue({ id: 'item-1', name: 'Item' }),
    } as unknown as Controller;

    renderWithSWR(<CoordinatedMetadataHarness itemId="item-1" controller={controller} />);
    await waitFor(() =>
      expect(rowForKey('Material')).toHaveAttribute('data-state', 'same')
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Refresh unrestricted metadata' })
    );
    await waitFor(() => expect(requestCount.current).toBe(2));

    // SWR still has data for this key while the refresh is in flight, so this
    // is not a partial comparison and should not replace the table with loading.
    expect(screen.queryByText('Loading metadata...')).not.toBeInTheDocument();
    expect(rowForKey('Material')).toHaveAttribute('data-state', 'same');

    await act(async () => {
      refresh.resolve(sceneItem('item-1', 'Steel'));
      await refresh.promise;
    });
    await waitFor(() => expect(requestCount.current).toBe(2));
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
