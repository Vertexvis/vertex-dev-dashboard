import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import React, { useCallback } from "react";
import useSWR from "swr";

import { SceneDrawer } from "../components/scene/SceneDrawer";
import { Layout } from "../components/shared/Layout";
import { isErrorRes } from "../lib/api";
import { Scene, toScene } from "../lib/scenes";
import { queryParamValue, updateRouterQuery } from "../lib/url-state";
import { defaultServerSideProps } from "../lib/with-session";

const SceneTable = dynamic(() => import("../components/scene/SceneTable"), {
  ssr: false,
});

export default function Home(): JSX.Element {
  const router = useRouter();
  const [editing, setEditing] = React.useState<boolean>(false);
  const [scene, setScene] = React.useState<Scene | undefined>();
  const sceneId = queryParamValue(router.query.sceneId);
  const editingQueryParam = queryParamValue(router.query.editing);
  const { data: selectedScene } = useSWR(
    router.isReady && sceneId != null
      ? `/api/scenes/${encodeURIComponent(sceneId)}`
      : null
  );
  const drawerOpen = Boolean(scene);
  const [invalidationCount, setInvalidationCount] = React.useState(0);

  React.useEffect(() => {
    if (!router.isReady) return;

    if (sceneId == null) {
      setScene(undefined);
      setEditing(false);
      return;
    }

    if (selectedScene != null && !isErrorRes(selectedScene)) {
      setScene(toScene(selectedScene));
      setEditing(editingQueryParam === "true");
    }
  }, [editingQueryParam, router.isReady, sceneId, selectedScene]);

  function handleClick(s: Scene) {
    setScene(s);
    setEditing(false);
    updateRouterQuery(router, { editing: undefined, sceneId: s.id });
  }

  function handleEditClick(s: Scene) {
    setScene(s);
    setEditing(true);
    updateRouterQuery(router, { editing: "true", sceneId: s.id });
  }

  const handleClose = useCallback(() => {
    setScene(undefined);
    setEditing(false);
    setInvalidationCount((current) => current + 1);
    updateRouterQuery(router, { editing: undefined, sceneId: undefined });
  }, [router]);

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
