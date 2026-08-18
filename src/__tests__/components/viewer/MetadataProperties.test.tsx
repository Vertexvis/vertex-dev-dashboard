import { render, screen } from '@testing-library/react';
import React from 'react';

import { MetadataProperties } from '../../../components/viewer/MetadataProperties';

describe('MetadataProperties', () => {
  it('explains that developer properties are not restricted by the viewer policy', () => {
    render(<MetadataProperties metadata={{ properties: { Name: 'Example part' } }} />);

    expect(
      screen.getByRole('button', { name: 'About developer properties' })
    ).toBeInTheDocument();
  });
});
