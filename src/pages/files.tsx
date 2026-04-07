import dynamic from "next/dynamic";
import React from "react";

import { FileDetailsDrawer } from "../components/file/FileDetailsDrawer";
import { Layout } from "../components/shared/Layout";
import { File } from "../lib/files";
import { defaultServerSideProps } from "../lib/with-session";

const FilesTable = dynamic(() => import("../components/file/FileTable"), {
  ssr: false,
});

export default function Files(): JSX.Element {
  const [file, setFile] = React.useState<File | undefined>();
  const drawerOpen = Boolean(file);

  return (
    <Layout
      main={
        <FilesTable activeFileId={file?.id} onFileSelected={setFile} />
      }
      rightDrawer={
        <FileDetailsDrawer
          file={file}
          onClose={() => setFile(undefined)}
          open={drawerOpen}
        />
      }
      rightDrawerOpen={drawerOpen}
    />
  );
}

export const getServerSideProps = defaultServerSideProps;
