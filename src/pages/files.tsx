import React from "react";

import { FilesTable } from "../components/file/FileTable";
import { Header } from "../components/shared/Header";
import { LeftDrawer } from "../components/shared/LeftDrawer";
import { Layout } from "../components/viewer/Layout";

export default function Files(): JSX.Element {
  return (
    <Layout
      header={<Header />}
      leftDrawer={<LeftDrawer />}
      leftDrawerOpen
      main={<FilesTable />}
    />
  );
}
