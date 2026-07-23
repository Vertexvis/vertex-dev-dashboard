import { Alert, Box } from "@mui/material";
import { FileList } from "@vertexvis/api-client-node";
import dynamic from "next/dynamic";
import React from "react";
import useSWR from "swr";

import { FileDetailsDrawer } from "../components/file/FileDetailsDrawer";
import { AppLink } from "../components/shared/AppLink";
import { Layout } from "../components/shared/Layout";
import { ErrorRes } from "../lib/api";
import { File, toFile } from "../lib/files";
import {
  filesRouteStateDefinition,
  FileTableRouteState,
} from "../lib/files-route-state";
import { SetRouteState, useRouteState } from "../lib/route-state";
import { defaultServerSideProps } from "../lib/with-session";

const RouteStateFileTable = dynamic(
  () => import("../components/file/RouteStateFileTable"),
  { ssr: false }
);

type FileData = FileList["data"][number];

export default function FilesRouteState(): JSX.Element {
  const [state, setState] = useRouteState(filesRouteStateDefinition);
  const [selectedFromTable, setSelectedFromTable] = React.useState<File>();
  const { data: selectedFromUrl } = useSWR<FileData | ErrorRes>(
    state.selectedFileId != null
      ? `/api/files/${encodeURIComponent(state.selectedFileId)}`
      : null
  );

  const selectedFile =
    selectedFromTable?.id === state.selectedFileId
      ? selectedFromTable
      : selectedFromUrl != null && "attributes" in selectedFromUrl
      ? toFile(selectedFromUrl)
      : undefined;
  const drawerOpen = state.selectedFileId != null;

  const setTableState = React.useCallback<SetRouteState<FileTableRouteState>>(
    (update, options) =>
      setState((current) => {
        const table =
          typeof update === "function" ? update(current.table) : update;
        return { ...current, table };
      }, options),
    [setState]
  );

  function handleFileSelected(file: File) {
    setSelectedFromTable(file);
    void setState((current) => ({ ...current, selectedFileId: file.id }), {
      history: "push",
    });
  }

  function handleClose() {
    setSelectedFromTable(undefined);
    void setState((current) => ({ ...current, selectedFileId: undefined }), {
      history: "push",
    });
  }

  return (
    <Layout
      main={
        <>
          <Box sx={{ mx: 2, mt: 2 }}>
            <Alert severity="info">
              This page stores its transferable state in one URL-backed object.{" "}
              <AppLink href="/files">View the original Files page.</AppLink>
            </Alert>
          </Box>
          <RouteStateFileTable
            activeFileId={state.selectedFileId}
            onFileSelected={handleFileSelected}
            onRouteStateChange={setTableState}
            routeState={state.table}
          />
        </>
      }
      rightDrawer={
        <FileDetailsDrawer
          file={selectedFile}
          onClose={handleClose}
          open={drawerOpen}
        />
      }
      rightDrawerOpen={drawerOpen}
    />
  );
}

export const getServerSideProps = defaultServerSideProps;
