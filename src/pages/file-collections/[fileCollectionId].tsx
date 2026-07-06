import { Box, Breadcrumbs, Link, Paper, Typography } from "@mui/material";
import { head } from "@vertexvis/api-client-node";
import { GetServerSidePropsResult } from "next";
import dynamic from "next/dynamic";
import { withIronSession } from "next-iron-session";
import React from "react";

import { FileDetailsDrawer } from "../../components/file/FileDetailsDrawer";
import { FileCollectionMetadataTable } from "../../components/file-collection/FileCollectionMetadataTable";
import { Layout } from "../../components/shared/Layout";
import { isErrorFailure, toErrorRes } from "../../lib/api";
import {
  FileCollection,
  getFileCollectionsApi,
  toFileCollection,
} from "../../lib/file-collections";
import { File } from "../../lib/files";
import { getClientFromSession, makeCall } from "../../lib/vertex-api";
import {
  CommonProps,
  CookieAttributes,
  NextIronRequest,
  serverSidePropsHandler as commonServerSidePropsHandler,
} from "../../lib/with-session";

interface Props {
  readonly fileCollection: FileCollection;
}

const FilesTable = dynamic(() => import("../../components/file/FileTable"), {
  ssr: false,
});

type ServerSideProps = CommonProps & Props;

interface ServerSideContext {
  readonly query: {
    readonly fileCollectionId?: string | string[];
  };
  readonly req: NextIronRequest;
}

export default function FileCollectionDetails({
  fileCollection,
}: Props): JSX.Element {
  const [file, setFile] = React.useState<File | undefined>();
  const drawerOpen = Boolean(file);
  const filesApiPath = `/api/file-collections/${encodeURIComponent(
    fileCollection.id
  )}/files`;

  return (
    <Layout
      main={
        <Box sx={{ p: 2 }}>
          <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
            <Link href="/file-collections" underline="hover">
              File Collections
            </Link>
            <Typography color="text.primary">
              {fileCollection.name ?? fileCollection.id}
            </Typography>
          </Breadcrumbs>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h5">File Collection Details</Typography>
            <Typography
              color="text.secondary"
              sx={{ overflowWrap: "anywhere", whiteSpace: "normal" }}
              variant="body2"
            >
              {fileCollection.id}
            </Typography>
            <Box sx={{ mt: 2 }}>
              <FileCollectionMetadataTable fileCollection={fileCollection} />
            </Box>
          </Paper>
          <FilesTable
            activeFileId={file?.id}
            apiPath={filesApiPath}
            emptyOnLoadError={false}
            logLoadError={false}
            onFileSelected={setFile}
            showCreateButton={false}
            showDeleteAction={false}
            showSuppliedIdFilter={false}
          />
        </Box>
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

export const getServerSideProps = withIronSession(
  serverSidePropsHandler,
  CookieAttributes
);

export async function serverSidePropsHandler({
  query,
  req,
}: ServerSideContext): Promise<GetServerSidePropsResult<ServerSideProps>> {
  const authResult = commonServerSidePropsHandler({ req });
  if (!("props" in authResult)) return authResult;

  const fileCollectionId = head(query.fileCollectionId);
  if (fileCollectionId == null) return { notFound: true };

  const api = getFileCollectionsApi(await getClientFromSession(req.session));
  const res = await makeCall(() =>
    api.getFileCollection({ id: fileCollectionId })
  );

  if (isErrorFailure(res)) {
    const error = toErrorRes({ failure: res });
    if (error.status === 400 || error.status === 404) return { notFound: true };

    throw new Error(error.message);
  }

  return {
    props: {
      ...(authResult.props as CommonProps),
      fileCollection: toFileCollection(res.data),
    },
  };
}
