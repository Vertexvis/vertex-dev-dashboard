import { SceneData } from '@vertexvis/api-client-node';
import dynamic from 'next/dynamic';
import { parseAsString, useQueryState } from 'nuqs';
import React, { useCallback } from 'react';
import useSWR from 'swr';

import { SceneDrawer } from '../components/scene/SceneDrawer';
import { Layout } from '../components/shared/Layout';
import { ErrorRes } from '../lib/api';
import { Scene } from '../lib/scenes';
import { defaultServerSideProps } from '../lib/with-session';

const SceneTable = dynamic(() => import('../components/scene/SceneTable'), {
  ssr: false,
});

function toSelectedScene(data?: SceneData | ErrorRes): Scene | undefined {
  if (data == null || !('attributes' in data)) return undefined;
  return { ...data.attributes, id: data.id };
}

export default function Home(): JSX.Element {
  const [editing, setEditing] = React.useState<boolean>(false);
  const [selectedSceneId, setSelectedSceneId] = useQueryState(
    'sceneId',
    parseAsString.withOptions({ history: 'push' })
  );
  const [invalidationCount, setInvalidationCount] = React.useState(0);

  const { data: selectedFromUrl } = useSWR<SceneData | ErrorRes>(
    selectedSceneId != null ? `/api/scenes/${encodeURIComponent(selectedSceneId)}` : null
  );
  const scene = toSelectedScene(selectedFromUrl);
  const drawerOpen = selectedSceneId != null;

  function handleClick(s: Scene): void {
    void setSelectedSceneId(s.id);
    setEditing(false);
  }

  function handleEditClick(s: Scene): void {
    void setSelectedSceneId(s.id);
    setEditing(true);
  }

  const handleClose = useCallback(() => {
    void setSelectedSceneId(null);
    setEditing(false);
    setInvalidationCount((count) => count + 1);
  }, [setSelectedSceneId]);

  return (
    <Layout
      main={
        <SceneTable
          onClick={handleClick}
          onEditClick={handleEditClick}
          scene={scene}
          invalidationCount={invalidationCount}
        />
      }
      rightDrawer={
        <SceneDrawer
          editing={editing}
          onClose={handleClose}
          open={drawerOpen}
          scene={scene}
        />
      }
      rightDrawerOpen={drawerOpen}
    />
  );
}

export const getServerSideProps = defaultServerSideProps;
