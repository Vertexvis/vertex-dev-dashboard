import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { RightDrawer } from '../../../components/viewer/RightDrawer';
import { ModelViewsState } from '../../../lib/model-views';

const modelViews: ModelViewsState = {
  annotationList: [],
  modelViewList: [],
  actions: {
    fetchNextAnnotations: jest.fn(),
    fetchNextModelViews: jest.fn(),
    loadModelView: jest.fn(),
    unloadModelView: jest.fn(),
  },
};
const originalInnerWidth = window.innerWidth;

describe('RightDrawer', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: originalInnerWidth,
    });
  });

  it("resizes with arrow keys from the drawer's perspective", () => {
    render(<RightDrawer modelViews={modelViews} onViewStateSelected={jest.fn()} />);

    const resizeHandle = screen.getByRole('separator', {
      name: 'Resize right drawer',
    });

    expect(resizeHandle).toHaveAttribute('aria-valuenow', '320');

    fireEvent.keyDown(resizeHandle, { key: 'ArrowLeft' });
    expect(resizeHandle).toHaveAttribute('aria-valuenow', '340');

    fireEvent.keyDown(resizeHandle, { key: 'ArrowRight' });
    expect(resizeHandle).toHaveAttribute('aria-valuenow', '320');
  });

  it('renders a vertical separator handle', () => {
    render(<RightDrawer modelViews={modelViews} onViewStateSelected={jest.fn()} />);

    const handle = screen.getByRole('separator');
    expect(handle).toHaveAttribute('aria-orientation', 'vertical');
  });

  it('updates the drawer width on drag', () => {
    const { container } = render(
      <RightDrawer modelViews={modelViews} onViewStateSelected={jest.fn()} />
    );

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
