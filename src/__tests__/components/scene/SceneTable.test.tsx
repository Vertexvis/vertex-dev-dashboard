import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { NuqsTestingAdapter, UrlUpdateEvent } from 'nuqs/adapters/testing';
import React from 'react';

import { installJsdomMockServer } from '../../../../test/msw/installJsdomMockServer';
import { server } from '../../../../test/msw/server';
import { renderWithSWR } from '../../../../test/render/renderWithSWR';
import SceneTable from '../../../components/scene/SceneTable';
import { Scene } from '../../../lib/scenes';

const mockPush = jest.fn();

jest.mock('next/router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const scene: Scene = {
  id: 'scene-1',
  created: '2026-07-01T15:30:00Z',
  name: 'Scene One',
  state: 'ready',
  suppliedId: 'supplied-scene-1',
};

const secondScene: Scene = {
  id: 'scene-2',
  created: '2026-07-02T15:30:00Z',
  name: 'Scene Two',
  state: 'ready',
  suppliedId: 'supplied-scene-2',
};

const page = {
  cursors: { self: 'page-1' },
  data: [
    {
      type: 'scene',
      id: scene.id,
      attributes: {
        created: scene.created,
        name: scene.name,
        state: scene.state,
        suppliedId: scene.suppliedId,
      },
    },
    {
      type: 'scene',
      id: secondScene.id,
      attributes: {
        created: secondScene.created,
        name: secondScene.name,
        state: secondScene.state,
        suppliedId: secondScene.suppliedId,
      },
    },
  ],
  status: 200,
};

describe('SceneTable', () => {
  installJsdomMockServer();

  afterEach(() => {
    jest.restoreAllMocks();
    mockPush.mockClear();
  });

  it('preserves the active scene highlight after the drawer scene clears', async () => {
    server.use(
      http.get('*/api/scenes', () => {
        return HttpResponse.json(page);
      })
    );

    const { rerender } = renderTable(scene);

    await waitFor(() => {
      expect(getSceneRow()).toHaveClass('Mui-selected');
    });

    rerender(renderTableElement(undefined));

    await waitFor(() => {
      expect(getSceneRow()).toHaveClass('Mui-selected');
    });
  });

  it('updates the active highlight immediately when another scene is clicked', async () => {
    server.use(
      http.get('*/api/scenes', () => {
        return HttpResponse.json(page);
      })
    );

    renderTable(scene);

    await waitFor(() => {
      expect(getSceneRow('Scene One')).toHaveClass('Mui-selected');
    });

    await userEvent.click(getSceneRow('Scene Two'));

    await waitFor(() => {
      expect(getSceneRow('Scene Two')).toHaveClass('Mui-selected');
    });
    expect(getSceneRow('Scene One')).not.toHaveClass('Mui-selected');
  });

  it('shows an open hint on the scene name', async () => {
    server.use(
      http.get('*/api/scenes', () => {
        return HttpResponse.json(page);
      })
    );

    renderTable(scene);

    const name = await screen.findByLabelText('Open Scene One');
    await userEvent.hover(name);

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Open Scene One');
  });

  it('renders a dedicated scene viewer href', async () => {
    const onClick = jest.fn();

    server.use(
      http.get('*/api/scenes', () => {
        return HttpResponse.json(page);
      })
    );

    renderTable(scene, { onClick });

    expect(await screen.findByLabelText('Open Scene One')).toHaveAttribute(
      'href',
      '/scene-viewer/scene-1'
    );
  });

  it('loads transferable table state from the URL', async () => {
    const requests: string[] = [];

    server.use(
      http.get('*/api/scenes', ({ request }) => {
        requests.push(request.url);
        return HttpResponse.json(page);
      })
    );

    renderTable(undefined, undefined, {
      searchParams:
        '?sceneName=alpha&sceneSuppliedId=supplied-scene-1' +
        '&sceneCursor=cursor-2&scenePage=2',
    });

    expect(await screen.findByText('Scene One')).toBeInTheDocument();
    expect(screen.getByLabelText('Name Filter')).toHaveValue('alpha');
    expect(screen.getByLabelText('Supplied ID Filter')).toHaveValue('supplied-scene-1');
    expect(screen.getByLabelText('Go to previous page')).toBeDisabled();

    const request = new URL(requests[0]);
    expect(request.searchParams.get('cursor')).toBe('cursor-2');
    expect(request.searchParams.get('name')).toBe('alpha');
    expect(request.searchParams.get('suppliedId')).toBe('supplied-scene-1');
  });

  it('updates a filter and resets paging as one URL update', async () => {
    const events: UrlUpdateEvent[] = [];

    server.use(http.get('*/api/scenes', () => HttpResponse.json(page)));

    renderTable(undefined, undefined, {
      onUrlUpdate: (event) => events.push(event),
      searchParams: '?sceneCursor=cursor-2&scenePage=2',
    });

    expect(await screen.findByText('Scene One')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Name Filter'), 'alpha');

    await waitFor(() => {
      const last = events[events.length - 1];
      expect(last?.searchParams.get('sceneName')).toBe('alpha');
    });

    const last = events[events.length - 1];
    expect(last.options.history).toBe('replace');
    expect(last.searchParams.has('sceneCursor')).toBe(false);
    expect(last.searchParams.has('scenePage')).toBe(false);
    expect(screen.getByLabelText('Name Filter')).toHaveValue('alpha');
  });

  it('moves forward with the API cursor using push history', async () => {
    const events: UrlUpdateEvent[] = [];

    server.use(
      http.get('*/api/scenes', () =>
        HttpResponse.json({
          ...page,
          cursors: { self: 'page-1', next: 'page-2' },
        })
      )
    );

    renderTable(undefined, undefined, {
      onUrlUpdate: (event) => events.push(event),
    });

    expect(await screen.findByText('Scene One')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Go to next page'));

    await waitFor(() => expect(events.length).toBe(1));
    expect(events[0].options.history).toBe('push');
    expect(events[0].searchParams.get('sceneCursor')).toBe('page-2');
    expect(events[0].searchParams.get('scenePage')).toBe('1');
  });
});

function getSceneRow(name = 'Scene One'): HTMLTableRowElement {
  const row = screen.getByText(name).closest('tr');
  if (row == null) throw new Error('Could not find scene row.');

  return row;
}

interface AdapterProps {
  readonly onUrlUpdate?: (event: UrlUpdateEvent) => void;
  readonly searchParams?: string;
}

function renderTable(
  scene?: Scene,
  props: Partial<React.ComponentProps<typeof SceneTable>> = {},
  adapterProps: AdapterProps = {}
): ReturnType<typeof renderWithSWR> {
  return renderWithSWR(renderTableElement(scene, props, adapterProps));
}

function renderTableElement(
  scene?: Scene,
  props: Partial<React.ComponentProps<typeof SceneTable>> = {},
  adapterProps: AdapterProps = {}
): JSX.Element {
  return (
    <NuqsTestingAdapter
      hasMemory={true}
      onUrlUpdate={adapterProps.onUrlUpdate}
      searchParams={adapterProps.searchParams}
    >
      <SceneTable
        invalidationCount={0}
        onClick={jest.fn()}
        onEditClick={jest.fn()}
        scene={scene}
        {...props}
      />
    </NuqsTestingAdapter>
  );
}
