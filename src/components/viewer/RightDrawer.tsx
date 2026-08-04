import { Box, Drawer } from '@mui/material';
import { drawerClasses } from '@mui/material/Drawer';
import { SceneViewStateData } from '@vertexvis/api-client-node';
import React from 'react';

import { Metadata } from '../../lib/metadata';
import { ModelViewsState } from '../../lib/model-views';
import { RightDrawerWidth } from './Layout';
import { MetadataCompare } from './MetadataCompare';
import { MetadataStatus } from './MetadataStates';
import { ModelViews } from './ModelViews';
import { SceneViewStateList } from './SceneViewStateList';

interface Props {
  readonly active?: string;
  // Policy-aware metadata (Web SDK `listSceneItemMetadata`) — what the policy
  // exposes. This is the RESTRICTED column of the comparison.
  readonly metadata?: Metadata;
  // Full metadata from the server-side REST path that ignores the policy — the
  // UNRESTRICTED column of the comparison.
  readonly unrestrictedMetadata?: Metadata;
  // True when the unrestricted-baseline fetch failed, so the comparison can warn
  // rather than imply the policy removed nothing.
  readonly unrestrictedError?: boolean;
  // Raw render-frame metadata delivered inline with the raycaster hit
  // (`toMetadata({ hit })`) — the STREAM column of the comparison. Only present
  // after clicking an item in the viewer.
  readonly streamMetadata?: Metadata;
  readonly metadataStatus?: MetadataStatus;
  readonly metadataError?: string;
  readonly metadataDiagnostic?: string;
  readonly modelViews: ModelViewsState;
  readonly sceneViewStates?: SceneViewStateData[];
  readonly onViewStateSelected: (arg0: string) => void;
}

const MinWidth = 280;
const MinViewerWidth = 280;
const StorageKey = 'viewer.rightDrawerWidth';
const KeyboardStep = 20;

function fallbackMaxWidth(): number {
  if (typeof window === 'undefined') return 800;
  return Math.min(800, Math.round(window.innerWidth * 0.7));
}

function clampWidth(width: number, maximum: number): number {
  return Math.max(MinWidth, Math.min(width, maximum));
}

function readStoredWidth(): number {
  if (typeof window === 'undefined') return RightDrawerWidth;
  const raw = window.localStorage.getItem(StorageKey);
  const parsed = raw != null ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed)
    ? clampWidth(parsed, fallbackMaxWidth())
    : RightDrawerWidth;
}

export function RightDrawer({
  active,
  metadata,
  unrestrictedMetadata,
  unrestrictedError,
  streamMetadata,
  metadataStatus,
  metadataError,
  metadataDiagnostic,
  modelViews,
  sceneViewStates,
  onViewStateSelected,
}: Props): JSX.Element {
  const [width, setWidth] = React.useState(RightDrawerWidth);
  const drawerRef = React.useRef<HTMLDivElement>(null);
  const draggingRef = React.useRef(false);
  const dragStartRef = React.useRef({ clientX: 0, width: RightDrawerWidth });

  const maxWidth = React.useCallback((currentWidth: number): number => {
    const viewer = drawerRef.current?.previousElementSibling;
    if (viewer instanceof HTMLElement) {
      const availableWidth =
        currentWidth + Math.max(0, viewer.clientWidth - MinViewerWidth);
      return Math.max(MinWidth, Math.min(800, availableWidth));
    }
    return fallbackMaxWidth();
  }, []);

  function setAndPersistWidth(nextWidth: number): void {
    setWidth((currentWidth) => {
      const clampedWidth = clampWidth(nextWidth, maxWidth(currentWidth));
      window.localStorage.setItem(StorageKey, String(clampedWidth));
      return clampedWidth;
    });
  }

  React.useEffect(() => {
    setWidth((currentWidth) => clampWidth(readStoredWidth(), maxWidth(currentWidth)));
  }, [maxWidth]);

  React.useEffect(() => {
    function stopDragging(): void {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.userSelect = '';
      setWidth((current) => {
        window.localStorage.setItem(StorageKey, String(current));
        return current;
      });
    }

    function onMouseMove(event: MouseEvent): void {
      if (!draggingRef.current) return;
      const { clientX, width: startWidth } = dragStartRef.current;
      setWidth(clampWidth(startWidth + clientX - event.clientX, maxWidth(startWidth)));
    }

    function onResize(): void {
      setWidth((currentWidth) => clampWidth(currentWidth, maxWidth(currentWidth)));
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', stopDragging);
    window.addEventListener('blur', stopDragging);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', stopDragging);
      window.removeEventListener('blur', stopDragging);
      window.removeEventListener('resize', onResize);
      document.body.style.userSelect = '';
    };
  }, [maxWidth]);

  function handleMouseDown(event: React.MouseEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();
    draggingRef.current = true;
    dragStartRef.current = { clientX: event.clientX, width };
    document.body.style.userSelect = 'none';
  }

  function handleDoubleClick(): void {
    setAndPersistWidth(RightDrawerWidth);
  }

  function handleKeyDown(event: React.KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        setAndPersistWidth(width + KeyboardStep);
        break;
      case 'ArrowRight':
        event.preventDefault();
        setAndPersistWidth(width - KeyboardStep);
        break;
      case 'Home':
        event.preventDefault();
        setAndPersistWidth(MinWidth);
        break;
      case 'End':
        event.preventDefault();
        setAndPersistWidth(maxWidth(width));
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        handleDoubleClick();
        break;
      default:
        break;
    }
  }

  const getDisplayedContent = (): JSX.Element => {
    switch (active) {
      case 'properties':
        return (
          <MetadataCompare
            unrestricted={unrestrictedMetadata}
            unrestrictedError={unrestrictedError}
            restricted={metadata}
            stream={streamMetadata}
            status={metadataStatus}
            error={metadataError}
            diagnostic={metadataDiagnostic}
          />
        );
      case 'scene-view-states':
        return (
          <SceneViewStateList
            sceneViewStates={sceneViewStates}
            onViewStateSelected={onViewStateSelected}
          />
        );
      case 'model-views':
        return <ModelViews modelViews={modelViews} metadata={metadata} />;
      default:
        return <></>;
    }
  };

  return (
    <Drawer
      anchor="right"
      ref={drawerRef}
      sx={{
        display: { sm: 'block', xs: 'none' },
        position: 'relative',
        width,
        [`& .${drawerClasses.paper}`]: { width },
      }}
      PaperProps={{
        style: { width },
        sx: {
          position: 'relative',
        },
      }}
      variant="permanent"
    >
      <Box
        aria-label="Resize right drawer"
        aria-orientation="vertical"
        aria-valuemax={maxWidth(width)}
        aria-valuemin={MinWidth}
        aria-valuenow={width}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleKeyDown}
        onMouseDown={handleMouseDown}
        role="separator"
        tabIndex={0}
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: '6px',
          cursor: 'col-resize',
          zIndex: 1,
          '&:hover': { backgroundColor: 'action.hover' },
        }}
      />
      {getDisplayedContent()}
    </Drawer>
  );
}
