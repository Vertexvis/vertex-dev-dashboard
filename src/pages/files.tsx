import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import React from "react";
import useSWR from "swr";

import { FileDetailsDrawer } from "../components/file/FileDetailsDrawer";
import { Layout } from "../components/shared/Layout";
import { isErrorRes } from "../lib/api";
import { File, toFile } from "../lib/files";
import { queryParamValue, updateRouterQuery } from "../lib/url-state";
import { defaultServerSideProps } from "../lib/with-session";

const FileTable = dynamic(() => import("../components/file/FileTable"), {
  ssr: false,
});

export default function Files(): JSX.Element {
  const router = useRouter();
  const [file, setFile] = React.useState<File | undefined>();
  const fileId = queryParamValue(router.query.fileId);
  const { data: selectedFile } = useSWR(
    router.isReady && fileId != null
      ? `/api/files/${encodeURIComponent(fileId)}`
      : null
  );
  const drawerOpen = Boolean(file);

  React.useEffect(() => {
    if (!router.isReady) return;

    if (fileId == null) {
      setFile(undefined);
      return;
    }

    if (selectedFile != null && !isErrorRes(selectedFile)) {
      setFile(toFile(selectedFile));
    }
  }, [fileId, router.isReady, selectedFile]);

  function handleFileSelected(selected: File) {
    setFile(selected);
    updateRouterQuery(router, { fileId: selected.id });
  }

  function handleClose() {
    setFile(undefined);
    updateRouterQuery(router, { fileId: undefined });
  }

  return (
    <Layout
      main={
        <FileTable
          activeFileId={file?.id}
          onFileSelected={handleFileSelected}
        />
      }
      rightDrawer={
        <FileDetailsDrawer
          file={file}
          onClose={handleClose}
          open={drawerOpen}
        />
      }
      rightDrawerOpen={drawerOpen}
    />
  );
}

export const getServerSideProps = defaultServerSideProps;
