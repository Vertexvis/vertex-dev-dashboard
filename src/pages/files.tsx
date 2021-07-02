import React from "react";

import { FilesTable } from "../components/file/FileTable";
import { Layout } from "../components/shared/Layout";
import { defaultServerSideProps } from "../lib/with-session";

export default function Files(): JSX.Element {
  return <Layout main={<FilesTable />} />;
}

export const getServerSideProps = defaultServerSideProps;
