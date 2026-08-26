import { FileList } from '@vertexvis/api-client-node';
import dynamic from 'next/dynamic';
import { parseAsString, useQueryState } from 'nuqs';
import React from 'react';
import useSWR from 'swr';

import { FileDetailsDrawer } from '../components/file/FileDetailsDrawer';
import { Layout } from '../components/shared/Layout';
import { ErrorRes } from '../lib/api';
import { File, toFile } from '../lib/files';
import { defaultServerSideProps } from '../lib/with-session';

const FileTable = dynamic(() => import('../components/file/FileTable'), {
  ssr: false,
});

type FileData = FileList['data'][number];

function toSelectedFile(data?: FileData | ErrorRes): File | undefined {
  if (data == null || !('attributes' in data)) return undefined;
  return toFile(data);
}

export default function Files(): JSX.Element {
  const [selectedFileId, setSelectedFileId] = useQueryState(
    'fileId',
    parseAsString.withOptions({ history: 'push' })
  );
  const { data: selectedFromUrl } = useSWR<FileData | ErrorRes>(
    selectedFileId != null ? `/api/files/${encodeURIComponent(selectedFileId)}` : null
  );

  const selectedFile = toSelectedFile(selectedFromUrl);
  const drawerOpen = selectedFileId != null;

  return (
    <Layout
      main={
        <FileTable
          activeFileId={selectedFileId ?? undefined}
          onFileSelected={(file) => void setSelectedFileId(file.id)}
        />
      }
      rightDrawer={
        <FileDetailsDrawer
          file={selectedFile}
          onClose={() => void setSelectedFileId(null)}
          open={drawerOpen}
        />
      }
      rightDrawerOpen={drawerOpen}
    />
  );
}

export const getServerSideProps = defaultServerSideProps;
