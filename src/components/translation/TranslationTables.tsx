import { Box } from "@mui/material";
import React from "react";

import { dateDiffInDays } from "../../lib/dates";
import { QueuedJob } from "../../lib/queued-jobs";
import { QueuedTranslationsTable } from "../translation/QueuedTranslationsTable";

interface TranslationTablesProps {
  readonly activeJobId?: string;
  readonly onJobSelected?: (job: QueuedJob) => void;
}

export default function TranslationTables({
  activeJobId,
  onJobSelected,
}: TranslationTablesProps): JSX.Element {
  return (
    <>
      <Box sx={{ display: "flex" }}>
        <QueuedTranslationsTable
          title="Running Translations"
          refreshInterval={10000}
          fetchAll={true}
          status="running"
          activeJobId={activeJobId}
          onRowClick={onJobSelected}
        />

        <QueuedTranslationsTable
          title="Recently Successful Translations"
          status="complete"
          fetchAll={false}
          filter={(row) => dateDiffInDays(new Date(row.created)) <= 2}
          activeJobId={activeJobId}
          onRowClick={onJobSelected}
        />

        <QueuedTranslationsTable
          title="Recently Failed Translations"
          refreshInterval={30000}
          status="error"
          filter={(row) => dateDiffInDays(new Date(row.created)) <= 5}
          activeJobId={activeJobId}
          onRowClick={onJobSelected}
        />
      </Box>
    </>
  );
}
