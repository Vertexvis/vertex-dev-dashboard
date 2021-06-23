import React from "react";

import { Header } from "../components/Header";
import { Layout } from "../components/Layout";
import { LeftDrawer } from "../components/LeftDrawer";
import { PartsTable } from "../components/PartTable";

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
