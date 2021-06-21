import React from "react";

import { FilesTable
 } from "../components/FileTable";
import { Header } from "../components/Header";
import { Layout } from "../components/Layout";
import { LeftDrawer } from "../components/LeftDrawer";

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
