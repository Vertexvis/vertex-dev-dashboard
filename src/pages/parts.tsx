import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import React from "react";
import useSWR from "swr";

import { PartRevisionDetailsDrawer } from "../components/part/PartRevisionDetailsDrawer";
import { Layout } from "../components/shared/Layout";
import { isErrorRes } from "../lib/api";
import { PartRevision, toPartRevision } from "../lib/part-revisions";
import { queryParamValue, updateRouterQuery } from "../lib/url-state";
import { defaultServerSideProps } from "../lib/with-session";

const PartTable = dynamic(() => import("../components/part/PartTable"), {
  ssr: false,
});

export default function Parts(): JSX.Element {
  const router = useRouter();
  const [revision, setRevision] = React.useState<PartRevision | undefined>();
  const partId = queryParamValue(router.query.partId);
  const revisionId = queryParamValue(router.query.revisionId);
  const { data: selectedRevision } = useSWR(
    router.isReady && revisionId != null
      ? `/api/part-revisions/${encodeURIComponent(revisionId)}`
      : null
  );
  const drawerOpen = Boolean(revision);

  React.useEffect(() => {
    if (!router.isReady) return;

    if (revisionId == null) {
      setRevision(undefined);
      return;
    }

    if (selectedRevision != null && !isErrorRes(selectedRevision)) {
      setRevision(toPartRevision(selectedRevision));
    }
  }, [revisionId, router.isReady, selectedRevision]);

  function handleRevisionSelected(
    selected: PartRevision,
    selectedPartId: string
  ) {
    setRevision(selected);
    updateRouterQuery(router, {
      partId: selectedPartId,
      revisionId: selected.id,
    });
  }

  function handleClose() {
    setRevision(undefined);
    updateRouterQuery(router, { partId: undefined, revisionId: undefined });
  }

  return (
    <Layout
      main={
        <PartTable
          activePartId={partId}
          activeRevisionId={revision?.id}
          onRevisionSelected={handleRevisionSelected}
        />
      }
      rightDrawer={
        <PartRevisionDetailsDrawer
          open={drawerOpen}
          partRevision={revision}
          onClose={handleClose}
        />
      }
      rightDrawerOpen={drawerOpen}
    />
  );
}

export const getServerSideProps = defaultServerSideProps;
