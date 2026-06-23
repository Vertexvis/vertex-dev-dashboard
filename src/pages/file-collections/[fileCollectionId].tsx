import dynamic from "next/dynamic";
import React from "react";

import { FileCollectionDetailsDrawer } from "../../components/file-collection/FileCollectionDetailsDrawer";
import { Layout } from "../../components/shared/Layout";
import { FileCollection } from "../../lib/file-collections";
import { defaultServerSideProps } from "../../lib/with-session";

const FileCollectionsTable = dynamic(
    () => import("../../components/file-collection/FileCollectionTable"),
    {
        ssr: false,
    }
);

export default function FileCollections(): JSX.Element {
    const [fileCollection, setFileCollection] = React.useState<
        FileCollection | undefined
    >();
    const drawerOpen = Boolean(fileCollection);

    return (
        <Layout
            main={
                <FileCollectionsTable
                    activeFileCollectionId={fileCollection?.id}
                    onFileCollectionSelected={setFileCollection}
                />
            }
            rightDrawer={
                <FileCollectionDetailsDrawer
                    fileCollection={fileCollection}
                    onClose={() => setFileCollection(undefined)}
                    open={drawerOpen}
                />
            }
            rightDrawerOpen={drawerOpen}
        />
    );
}

export const getServerSideProps = defaultServerSideProps;
