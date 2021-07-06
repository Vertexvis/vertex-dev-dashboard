import dynamic from "next/dynamic";
import React from "react";

import { Layout } from "../components/shared/Layout";
import { defaultServerSideProps } from "../lib/with-session";

const PartTable = dynamic(() => import("../components/part/PartTable"), {
  ssr: false,
});

export default function Parts(): JSX.Element {
  return <Layout main={<PartTable />} />;
}

export const getServerSideProps = defaultServerSideProps;
