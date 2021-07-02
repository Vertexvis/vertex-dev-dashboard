import React from "react";

import { PartTable } from "../components/part/PartTable";
import { Layout } from "../components/shared/Layout";
import { defaultServerSideProps } from "../lib/with-session";

export default function Parts(): JSX.Element {
  return <Layout main={<PartTable />} />;
}

export const getServerSideProps = defaultServerSideProps;
