import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import React from 'react';

import { installJsdomMockServer } from '../../../../test/msw/installJsdomMockServer';
import { server } from '../../../../test/msw/server';
import { renderWithSWR } from '../../../../test/render/renderWithSWR';
import AddPropertyKeyPolicyEntryDialog from '../../../components/property-key-policy/AddPropertyKeyPolicyEntryDialog';

describe('AddPropertyKeyPolicyEntryDialog', () => {
  installJsdomMockServer();

  it('shows the case-sensitivity helper text', () => {
    renderDialog();

    // The sentence is split across elements to emphasize key phrases, so assert
    // the emphasized fragments render rather than the full sentence.
    expect(screen.getByText('case-sensitive')).toBeInTheDocument();
    expect(screen.getByText('saved exactly as typed')).toBeInTheDocument();
  });

  it('pressing Enter in a property key field adds and focuses a new field', async () => {
    renderDialog();

    await userEvent.type(screen.getByLabelText('Property key 1'), 'Alpha{Enter}');

    const secondField = screen.getByLabelText('Property key 2');
    expect(secondField).toBeInTheDocument();
    expect(secondField).toHaveFocus();
    expect(screen.getByLabelText('Property key 1')).toHaveValue('Alpha');
  });

  it('flags a key that already exists on the policy and disables Add', async () => {
    renderDialog({ existingKeys: ['ExistingKey'] });

    await userEvent.type(screen.getByLabelText('Property key 1'), 'ExistingKey');

    expect(
      screen.getByText('Property key already exists on this policy.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();

    // Case-sensitive: a different case is not a duplicate.
    await userEvent.clear(screen.getByLabelText('Property key 1'));
    await userEvent.type(screen.getByLabelText('Property key 1'), 'existingkey');
    expect(
      screen.queryByText('Property key already exists on this policy.')
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled();
  });

  it('submits multiple keys verbatim (case preserved) and calls onAdded', async () => {
    const bodies: Array<Record<string, unknown>> = [];

    server.use(
      http.post('*/api/property-key-policies/:id/keys', async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ status: 201 }, { status: 201 });
      })
    );

    const onAdded = jest.fn();
    const onClose = jest.fn();
    renderDialog({ onAdded, onClose });

    await userEvent.type(screen.getByLabelText('Property key 1'), 'MixedCase_Key');
    await userEvent.click(screen.getByRole('button', { name: 'Add Property Key' }));
    await userEvent.type(screen.getByLabelText('Property key 2'), 'second_KEY');

    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ keys: ['MixedCase_Key', 'second_KEY'] });
    await waitFor(() => expect(onAdded).toHaveBeenCalled());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('filters blank keys before submitting', async () => {
    const bodies: Array<Record<string, unknown>> = [];

    server.use(
      http.post('*/api/property-key-policies/:id/keys', async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ status: 201 }, { status: 201 });
      })
    );

    renderDialog();

    await userEvent.type(screen.getByLabelText('Property key 1'), 'Only_Key');
    // Add a second, blank row that must be filtered out of the payload.
    await userEvent.click(screen.getByRole('button', { name: 'Add Property Key' }));

    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ keys: ['Only_Key'] });
  });

  it('shows the API error message when the add fails', async () => {
    server.use(
      http.post('*/api/property-key-policies/:id/keys', () =>
        HttpResponse.json(
          { message: 'Could not add keys.', status: 400 },
          { status: 400 }
        )
      )
    );

    const onAdded = jest.fn();
    const onClose = jest.fn();
    renderDialog({ onAdded, onClose });

    await userEvent.type(screen.getByLabelText('Property key 1'), 'Key');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByText('Could not add keys.')).toBeInTheDocument();
    expect(onAdded).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    // Dialog stays open and keeps the entered value.
    expect(screen.getByLabelText('Property key 1')).toHaveValue('Key');
  });
});

function renderDialog(
  props: {
    readonly onAdded?: () => void;
    readonly onClose?: () => void;
    readonly policyId?: string;
    readonly existingKeys?: readonly string[];
  } = {}
): void {
  renderWithSWR(
    <AddPropertyKeyPolicyEntryDialog
      existingKeys={props.existingKeys}
      onAdded={props.onAdded ?? jest.fn()}
      onClose={props.onClose ?? jest.fn()}
      open
      policyId={props.policyId ?? 'policy-1'}
    />
  );
}
