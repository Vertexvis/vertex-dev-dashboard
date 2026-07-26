import dynamic from "next/dynamic";
import React from "react";

import { FileDetailsDrawer } from "../components/file/FileDetailsDrawer";
import { FilePreviewDialog } from "../components/file/FilePreviewDialog";
import CreatePartDialog from "../components/part/CreatePartDialog";
import { Layout } from "../components/shared/Layout";
import { ViewTranslationsToast } from "../components/shared/ViewTranslationsToast";
import { File } from "../lib/files";
import { defaultServerSideProps } from "../lib/with-session";

const FileTable = dynamic(() => import("../components/file/FileTable"), {
  ssr: false,
});

export default function FilesPreview(): JSX.Element {
  const [file, setFile] = React.useState<File | undefined>();
  const [partTarget, setPartTarget] = React.useState<File | undefined>();
  const [previewTarget, setPreviewTarget] = React.useState<File | undefined>();
  const [toastMessage, setToastMessage] = React.useState<string | undefined>();
  const drawerOpen = Boolean(file);

  return (
    <Layout
      main={
        <>
          <FileTable
            activeFileId={file?.id}
            onCreatePart={setPartTarget}
            onFileSelected={setFile}
            onPreview={setPreviewTarget}
          />
          <FilePreviewDialog
            file={previewTarget}
            onClose={() => setPreviewTarget(undefined)}
            open={previewTarget != null}
          />
          <CreatePartDialog
            key={partTarget?.id}
            open={partTarget != null}
            onClose={() => setPartTarget(undefined)}
            onPartCreated={(queuedTranslationId) => {
              setToastMessage(
                `Translation initiated. Job ID: ${queuedTranslationId}`
              );
              setPartTarget(undefined);
            }}
            targetFileId={partTarget?.id}
            targetFileName={partTarget?.name}
          />
          <ViewTranslationsToast
            message={toastMessage}
            onClose={() => setToastMessage(undefined)}
            open={toastMessage != null}
          />
        </>
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
