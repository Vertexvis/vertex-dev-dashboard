import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import React from 'react';

import {
  propertyKeyPolicy,
  propertyKeyPolicyRes,
} from '../../../../test/msw/handlers/property-key-policies';
import { installJsdomMockServer } from '../../../../test/msw/installJsdomMockServer';
import { server } from '../../../../test/msw/server';
import { renderWithSWR } from '../../../../test/render/renderWithSWR';
import CreatePropertyKeyPolicyDialog from '../../../components/property-key-policy/CreatePropertyKeyPolicyDialog';

describe('CreatePropertyKeyPolicyDialog', () => {
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

  it('marks duplicate property keys with a per-field error and does not add a field', async () => {
    renderDialog();

    await userEvent.type(screen.getByLabelText('Property key 1'), 'Alpha{Enter}');
    await userEvent.type(screen.getByLabelText('Property key 2'), 'Alpha{Enter}');

    // Both fields are flagged as duplicates via the per-field error.
    expect(screen.getAllByText('Duplicate property key.')).toHaveLength(2);
    // Pressing Enter on the duplicate must not append a third field.
    expect(screen.queryByLabelText('Property key 3')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
  });

  it('marks a whitespace-only property key as invalid and disables Create', async () => {
    renderDialog();

    await userEvent.type(screen.getByLabelText(/Name/), 'My Policy');
    await userEvent.type(screen.getByLabelText('Property key 1'), '   ');

    expect(screen.getByText('Property key cannot be blank.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
  });

  it('clears the field error once the duplicate/blank is fixed', async () => {
    renderDialog();

    await userEvent.type(screen.getByLabelText(/Name/), 'My Policy');
    await userEvent.type(screen.getByLabelText('Property key 1'), 'Alpha{Enter}');
    await userEvent.type(screen.getByLabelText('Property key 2'), 'Alpha');

    // Duplicate state: both fields flagged and Create disabled.
    expect(screen.getAllByText('Duplicate property key.')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();

    // Fix the offending field with a unique, non-blank value.
    await userEvent.clear(screen.getByLabelText('Property key 2'));
    await userEvent.type(screen.getByLabelText('Property key 2'), 'Beta');

    expect(screen.queryByText('Duplicate property key.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create' })).toBeEnabled();
  });

  it('pressing Enter in an empty field does nothing', async () => {
    renderDialog();

    await userEvent.type(screen.getByLabelText('Property key 1'), '{Enter}');

    expect(screen.queryByLabelText('Property key 2')).not.toBeInTheDocument();
  });

  it('submits the key verbatim and maps the Deny mode to denylist', async () => {
    const bodies: Array<Record<string, unknown>> = [];

    server.use(
      http.post('*/api/property-key-policies', async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json(
          propertyKeyPolicyRes(propertyKeyPolicy({ id: 'policy-1' })),
          { status: 201 }
        );
      })
    );

    const onCreated = jest.fn();
    const onClose = jest.fn();
    renderDialog({ onClose, onCreated });

    await userEvent.type(screen.getByLabelText(/Name/), 'My Policy');
    await userEvent.click(screen.getByRole('radio', { name: 'Deny' }));
    await userEvent.type(screen.getByLabelText('Property key 1'), 'MixedCase_Key');

    await userEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({
      keys: ['MixedCase_Key'],
      mode: 'denylist',
      name: 'My Policy',
    });
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('shows the API error message when creation fails', async () => {
    server.use(
      http.post('*/api/property-key-policies', () =>
        HttpResponse.json(
          { message: 'Name already in use.', status: 400 },
          { status: 400 }
        )
      )
    );

    const onCreated = jest.fn();
    renderDialog({ onCreated });

    await userEvent.type(screen.getByLabelText(/Name/), 'Dup');
    await userEvent.type(screen.getByLabelText('Property key 1'), 'Key');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(await screen.findByText('Name already in use.')).toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();
    // Dialog stays open and keeps entered values.
    expect(screen.getByLabelText(/Name/)).toHaveValue('Dup');
  });

  it('warns when the policy is created but its keys fail', async () => {
    server.use(
      http.post('*/api/property-key-policies', () =>
        HttpResponse.json(
          {
            data: propertyKeyPolicy({ id: 'policy-1' }),
            keysError: 'Keys upsert failed.',
            status: 201,
          },
          { status: 201 }
        )
      )
    );

    const onCreated = jest.fn();
    const onClose = jest.fn();
    renderDialog({ onClose, onCreated });

    await userEvent.type(screen.getByLabelText(/Name/), 'Partial');
    await userEvent.type(screen.getByLabelText('Property key 1'), 'Key');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(await screen.findByText(/Keys upsert failed\./)).toBeInTheDocument();
    // Refresh is still triggered so the created policy is visible, but the
    // dialog stays open to surface the warning.
    expect(onCreated).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  describe('when fetch rejects (network error)', () => {
    it('shows the generic API error and keeps Create enabled', async () => {
      server.use(http.post('*/api/property-key-policies', () => HttpResponse.error()));

      const onCreated = jest.fn();
      const onClose = jest.fn();
      renderDialog({ onClose, onCreated });

      await userEvent.type(screen.getByLabelText(/Name/), 'My Policy');
      await userEvent.type(screen.getByLabelText('Property key 1'), 'Key');
      await userEvent.click(screen.getByRole('button', { name: 'Create' }));

      expect(
        await screen.findByText('Could not create the property key policy.')
      ).toBeInTheDocument();
      // onCreated must not be called — nothing was processed server-side.
      expect(onCreated).not.toHaveBeenCalled();
      // Dialog must stay in the normal state: Cancel + Create (not Close-only).
      expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
    });
  });

  describe('when fetch resolves but res.json() rejects', () => {
    it('calls onCreated, shows uncertain-outcome warning, and switches to Close-only', async () => {
      server.use(
        http.post(
          '*/api/property-key-policies',
          () =>
            new HttpResponse('not json', {
              headers: { 'Content-Type': 'application/json' },
              status: 201,
            })
        )
      );

      const onCreated = jest.fn();
      const onClose = jest.fn();
      renderDialog({ onClose, onCreated });

      await userEvent.type(screen.getByLabelText(/Name/), 'My Policy');
      await userEvent.type(screen.getByLabelText('Property key 1'), 'Key');
      await userEvent.click(screen.getByRole('button', { name: 'Create' }));

      // onCreated is called so the list refreshes in case the policy was created.
      await waitFor(() => expect(onCreated).toHaveBeenCalled());
      // The uncertain-outcome warning must be visible.
      expect(
        await screen.findByText(
          /The request completed but the response could not be read/
        )
      ).toBeInTheDocument();
      // Dialog must show only Close — no Create button (duplicate protection).
      expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Create' })).not.toBeInTheDocument();
      // onClose must NOT have been called automatically.
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});

function renderDialog(
  props: {
    readonly onClose?: () => void;
    readonly onCreated?: () => void;
  } = {}
): void {
  renderWithSWR(
    <CreatePropertyKeyPolicyDialog
      onClose={props.onClose ?? jest.fn()}
      onCreated={props.onCreated ?? jest.fn()}
      open
    />
  );
}
