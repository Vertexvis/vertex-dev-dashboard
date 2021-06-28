import React from "react";

import { FilesTable } from "../components/file/FileTable";
import { Layout } from "../components/shared/Layout";

export default function Files(): JSX.Element {
  return <Layout main={<FilesTable />} />;
}
