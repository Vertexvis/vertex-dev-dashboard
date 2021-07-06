import dynamic from "next/dynamic";
import React from "react";

import { Layout } from "../components/shared/Layout";
import { defaultServerSideProps } from "../lib/with-session";

const FilesTable = dynamic(() => import("../components/file/FileTable"), {
  ssr: false,
});

export default function Files(): JSX.Element {
  return <Layout main={<FilesTable />} />;
}

export const getServerSideProps = defaultServerSideProps;
