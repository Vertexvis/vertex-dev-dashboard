import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import React from 'react';

import {
  propertyKeyPolicyKey,
  propertyKeyPolicyKeysRes,
} from '../../../../test/msw/handlers/property-key-policies';
import { installJsdomMockServer } from '../../../../test/msw/installJsdomMockServer';
import { server } from '../../../../test/msw/server';
import { renderWithSWR } from '../../../../test/render/renderWithSWR';
import { PropertyKeyPolicyDetailsDrawer } from '../../../components/property-key-policy/PropertyKeyPolicyDetailsDrawer';
import {
  PropertyKeyPolicy,
  PropertyKeyPolicyMode,
} from '../../../lib/property-key-policies';

const policy: PropertyKeyPolicy = {
  createdAt: '2026-06-10T15:30:00Z',
  id: 'policy-1',
  mode: PropertyKeyPolicyMode.Denylist,
  name: 'My Policy',
  suppliedId: 'supplied-1',
};

describe('PropertyKeyPolicyDetailsDrawer', () => {
  installJsdomMockServer();

  it('renders policy attributes and case-preserved entry names', async () => {
    server.use(
      http.get('*/api/property-key-policies/:id/keys', () =>
        HttpResponse.json(
          propertyKeyPolicyKeysRes({
            data: [
              propertyKeyPolicyKey({ id: 'key-1', name: 'MixedCase_Key' }),
              propertyKeyPolicyKey({ id: 'key-2', name: 'ALLCAPS' }),
            ],
          })
        )
      )
    );

    renderDrawer();

    // Policy attributes render from the row prop (no single-policy GET needed).
    expect(await screen.findByText('My Policy')).toBeInTheDocument();
    expect(screen.getByText('Deny')).toBeInTheDocument();
    expect(screen.getByText('supplied-1')).toBeInTheDocument();

    // Entry key names render verbatim (case preserved).
    expect(await screen.findByText('MixedCase_Key')).toBeInTheDocument();
    expect(screen.getByText('ALLCAPS')).toBeInTheDocument();

    // Case-sensitivity note is present.
    expect(
      screen.getByText('Metadata property keys are case-sensitive.')
    ).toBeInTheDocument();

    // No misleading "full policy details" error appears.
    expect(
      screen.queryByText('Could not load the full policy details.')
    ).not.toBeInTheDocument();
  });

  it('shows an error when the entries endpoint fails', async () => {
    server.use(
      http.get('*/api/property-key-policies/:id/keys', () =>
        HttpResponse.json(
          { message: 'Could not load entries.', status: 500 },
          { status: 500 }
        )
      )
    );

    renderDrawer();

    // Attributes still render because they come from the row prop.
    expect(await screen.findByText('My Policy')).toBeInTheDocument();
    // The entries branch surfaces its own error.
    expect(await screen.findByText('Could not load property keys.')).toBeInTheDocument();
  });
});

function renderDrawer(): void {
  renderWithSWR(
    <PropertyKeyPolicyDetailsDrawer onClose={jest.fn()} open propertyKeyPolicy={policy} />
  );
}
