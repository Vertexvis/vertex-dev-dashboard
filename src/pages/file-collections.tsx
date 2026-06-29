import dynamic from "next/dynamic";

import { Layout } from "../components/shared/Layout";
export { defaultServerSideProps as getServerSideProps } from "../lib/with-session";

const FileCollectionsTable = dynamic(
  () => import("../components/file-collection/FileCollectionTable"),
  {
    ssr: false,
  }
);

export default function FileCollections(): JSX.Element {
  return <Layout main={<FileCollectionsTable />} />;
}
