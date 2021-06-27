import React from "react";

import { PartsTable } from "../components/part/PartTable";
import { Header } from "../components/shared/Header";
import { LeftDrawer } from "../components/shared/LeftDrawer";
import { Layout } from "../components/viewer/Layout";

export default function Parts(): JSX.Element {
  return (
    <Layout
      header={<Header />}
      leftDrawer={<LeftDrawer />}
      leftDrawerOpen
      main={<PartsTable />}
    />
  );
}
