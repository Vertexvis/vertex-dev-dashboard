import { Box } from "@mui/material";
import React from "react";

import { dateDiffInDays } from "../../lib/dates";
import { QueuedTranslationsTable } from "../translation/QueuedTranslationsTable";

export default function TranslationTables(): JSX.Element {
  return (
    <>
      <Box sx={{ display: "flex" }}>
        <QueuedTranslationsTable
          title="Running Translations"
          refreshInterval={10000}
          fetchAll={true}
          status="running"
        />

        <QueuedTranslationsTable
          title="Recently Successful Translations"
          status="complete"
          fetchAll={false}
          filter={(row) => dateDiffInDays(new Date(row.created)) <= 2}
        />

        <QueuedTranslationsTable
          title="Recently Failed Translations"
          refreshInterval={30000}
          status="error"
          filter={(row) => dateDiffInDays(new Date(row.created)) <= 5}
        />
      </Box>
    </>
  );
}
