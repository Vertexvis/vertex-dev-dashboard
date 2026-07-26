import { Close } from "@mui/icons-material";
import { Alert, Button, IconButton, Snackbar } from "@mui/material";
import dynamic from "next/dynamic";
import NextLink from "next/link";
import React from "react";

import { FileDetailsDrawer } from "../components/file/FileDetailsDrawer";
import CreatePartDialog from "../components/part/CreatePartDialog";
import { Layout } from "../components/shared/Layout";
import { File } from "../lib/files";
import { defaultServerSideProps } from "../lib/with-session";

const FileTable = dynamic(() => import("../components/file/FileTable"), {
  ssr: false,
});

export default function FilesPreview(): JSX.Element {
  const [file, setFile] = React.useState<File | undefined>();
  const [partTarget, setPartTarget] = React.useState<File | undefined>();
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
          />
          <CreatePartDialog
            open={partTarget != null}
            onClose={() => setPartTarget(undefined)}
            onPartCreated={(queuedTranslationId) => {
              setToastMessage(
                `Translation initiated. Job ID: ${queuedTranslationId}`
              );
              setPartTarget(undefined);
            }}
            targetFileId={partTarget?.id}
            targetFileName={partTarget?.name ?? undefined}
          />
          {/* Longer dwell than the error toasts: this one carries the "View
              translations" action, so give users time to reach it. */}
          <Snackbar
            open={toastMessage != null}
            autoHideDuration={12000}
            onClose={() => setToastMessage(undefined)}
          >
            <Alert
              action={
                <>
                  <Button
                    color="inherit"
                    component={NextLink}
                    href="/translations"
                    size="small"
                  >
                    View translations
                  </Button>
                  <IconButton
                    aria-label="Close"
                    color="inherit"
                    onClick={() => setToastMessage(undefined)}
                    size="small"
                  >
                    <Close fontSize="small" />
                  </IconButton>
                </>
              }
              onClose={() => setToastMessage(undefined)}
              severity="success"
            >
              {toastMessage}
            </Alert>
          </Snackbar>
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
