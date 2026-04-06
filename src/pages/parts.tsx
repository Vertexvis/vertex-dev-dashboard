import dynamic from "next/dynamic";
import React from "react";

import { PartRevisionDetailsDrawer } from "../components/part/PartRevisionDetailsDrawer";
import { Layout } from "../components/shared/Layout";
import { PartRevision } from "../lib/part-revisions";
import { defaultServerSideProps } from "../lib/with-session";

const PartTable = dynamic(() => import("../components/part/PartTable"), {
  ssr: false,
});

export default function Parts(): JSX.Element {
  const [revision, setRevision] = React.useState<PartRevision | undefined>();
  const drawerOpen = Boolean(revision);

  return (
    <Layout
      main={
        <PartTable
          activeRevisionId={revision?.id}
          onRevisionSelected={setRevision}
        />
      }
      rightDrawer={
        <PartRevisionDetailsDrawer
          open={drawerOpen}
          partRevision={revision}
          onClose={() => setRevision(undefined)}
        />
      }
      rightDrawerOpen={drawerOpen}
    />
  );
}

export const getServerSideProps = defaultServerSideProps;
