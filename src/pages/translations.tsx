import dynamic from "next/dynamic";
import React from "react";

import { Layout } from "../components/shared/Layout";
import { TranslationDetailsDrawer } from "../components/translation/TranslationDetailsDrawer";
import { QueuedJob } from "../lib/queued-jobs";
import { defaultServerSideProps } from "../lib/with-session";

const TranslationTables = dynamic(
  () => import("../components/translation/TranslationTables"),
  {
    ssr: false,
  }
);

export default function Translations(): JSX.Element {
  const [job, setJob] = React.useState<QueuedJob | undefined>();
  const drawerOpen = Boolean(job);

  return (
    <Layout
      main={
        <TranslationTables activeJobId={job?.id} onJobSelected={setJob} />
      }
      rightDrawer={
        <TranslationDetailsDrawer
          job={job}
          onClose={() => setJob(undefined)}
          open={drawerOpen}
        />
      }
      rightDrawerOpen={drawerOpen}
    />
  );
}

export const getServerSideProps = defaultServerSideProps;
