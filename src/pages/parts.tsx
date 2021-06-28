import React from "react";

import { PartTable } from "../components/part/PartTable";
import { Layout } from "../components/shared/Layout";

export default function Parts(): JSX.Element {
  return <Layout main={<PartTable />} />;
}
