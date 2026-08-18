import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import React from 'react';

import { installJsdomMockServer } from '../../../../test/msw/installJsdomMockServer';
import { server } from '../../../../test/msw/server';
import { renderWithSWR } from '../../../../test/render/renderWithSWR';
import { PolicySelect } from '../../../components/viewer/PolicySelect';

const policiesPage = {
  cursors: { self: 'page-1' },
  status: 200,
  data: [
    {
      type: 'property-key-policy',
      id: 'policy-1',
      attributes: {
        createdAt: '2026-06-01T00:00:00Z',
        name: 'My Allowlist',
        mode: 'allowlist',
        suppliedId: 'allow-1',
      },
    },
    {
      type: 'property-key-policy',
      id: 'policy-2',
      attributes: {
        createdAt: '2026-06-02T00:00:00Z',
        mode: 'denylist',
        suppliedId: 'deny-supplied',
      },
    },
  ],
};

function usePolicies(): void {
  server.use(
    http.get('*/api/property-key-policies', () => HttpResponse.json(policiesPage))
  );
}

describe('PolicySelect', () => {
  installJsdomMockServer();

  it('renders the active policy as the selected value', async () => {
    usePolicies();

    renderWithSWR(<PolicySelect policyId="policy-1" onChange={jest.fn()} />);

    await waitFor(() =>
      expect(screen.getByLabelText('Property Key Policy')).toHaveTextContent(
        /My Allowlist/
      )
    );
  });

  it('renders None plus each policy option', async () => {
    usePolicies();

    renderWithSWR(<PolicySelect onChange={jest.fn()} />);

    await userEvent.click(await screen.findByLabelText('Property Key Policy'));

    expect(
      await screen.findByRole('option', { name: /None \(unrestricted\)/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /My Allowlist/i })).toBeInTheDocument();
    // Policy 2 has no name, so it falls back to its suppliedId.
    expect(screen.getByRole('option', { name: /deny-supplied/i })).toBeInTheDocument();
  });

  it('loads the next cursor page using the explicit selector page size', async () => {
    const requestedPages: string[] = [];
    server.use(
      http.get('*/api/property-key-policies', ({ request }) => {
        const url = new URL(request.url);
        requestedPages.push(url.search);
        if (url.searchParams.get('cursor') === 'page-2') {
          return HttpResponse.json({
            cursors: { self: 'page-2' },
            data: [
              {
                type: 'property-key-policy',
                id: 'policy-51',
                attributes: {
                  createdAt: '2026-06-03T00:00:00Z',
                  mode: 'allowlist',
                  name: 'Policy on second page',
                },
              },
            ],
            status: 200,
          });
        }

        return HttpResponse.json({
          ...policiesPage,
          cursors: { next: 'page-2', self: 'page-1' },
        });
      })
    );

    renderWithSWR(<PolicySelect onChange={jest.fn()} />);

    const nextPage = await screen.findByRole('button', { name: 'Next policy page' });
    await waitFor(() => expect(nextPage).toBeEnabled());
    await userEvent.click(nextPage);

    await userEvent.click(screen.getByLabelText('Property Key Policy'));
    expect(
      await screen.findByRole('option', { name: /Policy on second page/i })
    ).toBeInTheDocument();
    expect(requestedPages).toEqual(['?pageSize=50', '?pageSize=50&cursor=page-2']);
  });

  it('replays the stored cursor when navigating back to a previous page', async () => {
    const requestedPages: string[] = [];
    server.use(
      http.get('*/api/property-key-policies', ({ request }) => {
        const url = new URL(request.url);
        requestedPages.push(url.search);
        if (url.searchParams.get('cursor') === 'page-2') {
          return HttpResponse.json({
            cursors: { self: 'page-2' },
            data: [
              {
                type: 'property-key-policy',
                id: 'policy-51',
                attributes: {
                  createdAt: '2026-06-03T00:00:00Z',
                  mode: 'allowlist',
                  name: 'Policy on second page',
                },
              },
            ],
            status: 200,
          });
        }

        // The initial load (no cursor) and the back-navigation replay
        // (cursor=page-1, the stored self cursor) both serve the first page.
        return HttpResponse.json({
          ...policiesPage,
          cursors: { next: 'page-2', self: 'page-1' },
        });
      })
    );

    renderWithSWR(<PolicySelect onChange={jest.fn()} />);

    const previousPage = await screen.findByRole('button', {
      name: 'Previous policy page',
    });
    const nextPage = screen.getByRole('button', { name: 'Next policy page' });

    // Previous is disabled on the first page.
    expect(previousPage).toBeDisabled();
    await waitFor(() => expect(nextPage).toBeEnabled());
    await userEvent.click(nextPage);

    // Second page loaded; Previous is now available.
    await waitFor(() => expect(previousPage).toBeEnabled());
    await userEvent.click(screen.getByLabelText('Property Key Policy'));
    expect(
      await screen.findByRole('option', { name: /Policy on second page/i })
    ).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');

    // Navigate back: the first page's stored self cursor is replayed.
    await userEvent.click(previousPage);
    await userEvent.click(await screen.findByLabelText('Property Key Policy'));
    expect(
      await screen.findByRole('option', { name: /My Allowlist/i })
    ).toBeInTheDocument();

    expect(requestedPages).toEqual([
      '?pageSize=50',
      '?pageSize=50&cursor=page-2',
      '?pageSize=50&cursor=page-1',
    ]);
  });

  it('keeps Previous enabled when a later page fails to load', async () => {
    server.use(
      http.get('*/api/property-key-policies', ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('cursor') === 'page-2') return HttpResponse.error();

        return HttpResponse.json({
          ...policiesPage,
          cursors: { next: 'page-2', self: 'page-1' },
        });
      })
    );

    renderWithSWR(<PolicySelect onChange={jest.fn()} />);

    const nextPage = await screen.findByRole('button', { name: 'Next policy page' });
    const previousPage = screen.getByRole('button', { name: 'Previous policy page' });
    await waitFor(() => expect(nextPage).toBeEnabled());
    await userEvent.click(nextPage);

    // The second page request failed, but the user can still page back to the
    // already-loaded first page; only forward navigation is blocked.
    await waitFor(() =>
      expect(screen.getByText('Could not load policies')).toBeInTheDocument()
    );
    expect(previousPage).toBeEnabled();
    expect(nextPage).toBeDisabled();
  });

  it('calls onChange with the selected policy id', async () => {
    usePolicies();
    const onChange = jest.fn();

    renderWithSWR(<PolicySelect onChange={onChange} />);

    await userEvent.click(await screen.findByLabelText('Property Key Policy'));
    await userEvent.click(await screen.findByRole('option', { name: /My Allowlist/i }));

    expect(onChange).toHaveBeenCalledWith('policy-1');
  });

  it('calls onChange with undefined when None is selected', async () => {
    usePolicies();
    const onChange = jest.fn();

    renderWithSWR(<PolicySelect policyId="policy-1" onChange={onChange} />);

    await userEvent.click(await screen.findByLabelText('Property Key Policy'));
    await userEvent.click(
      await screen.findByRole('option', { name: /None \(unrestricted\)/i })
    );

    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('disables the control and shows a spinner while policies load', async () => {
    server.use(
      http.get('*/api/property-key-policies', async () => {
        await delay('infinite');
        return HttpResponse.json(policiesPage);
      })
    );

    renderWithSWR(<PolicySelect onChange={jest.fn()} />);

    await waitFor(() =>
      expect(screen.getByLabelText('Property Key Policy')).toHaveAttribute(
        'aria-disabled',
        'true'
      )
    );
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('disables the control and shows an error caption when policies fail', async () => {
    server.use(http.get('*/api/property-key-policies', () => HttpResponse.error()));

    renderWithSWR(<PolicySelect onChange={jest.fn()} />);

    await waitFor(() =>
      expect(screen.getByText('Could not load policies')).toBeInTheDocument()
    );
    expect(screen.getByLabelText('Property Key Policy')).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });

  it('shows the error caption on a non-OK HTTP response with a JSON body', async () => {
    // A 500 that still returns a JSON body must be treated as an error (the
    // throwing fetcher), not resolved into data where it would crash the mapper.
    server.use(
      http.get('*/api/property-key-policies', () =>
        HttpResponse.json({ message: 'Upstream failure', status: 500 }, { status: 500 })
      )
    );

    renderWithSWR(<PolicySelect onChange={jest.fn()} />);

    await waitFor(() =>
      expect(screen.getByText('Could not load policies')).toBeInTheDocument()
    );
    expect(screen.getByLabelText('Property Key Policy')).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });

  it('respects the disabled prop', async () => {
    usePolicies();

    renderWithSWR(<PolicySelect onChange={jest.fn()} disabled />);

    await waitFor(() =>
      expect(screen.getByLabelText('Property Key Policy')).toHaveAttribute(
        'aria-disabled',
        'true'
      )
    );
  });
});
