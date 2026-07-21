import React from "react";

import { DocumentsPage } from "../components/artifacts/DocumentsPage";
import { Layout } from "../components/shared/Layout";
import { defaultServerSideProps } from "../lib/with-session";

export default function Documents(): JSX.Element {
  return <Layout main={<DocumentsPage />} />;
}

export const getServerSideProps = defaultServerSideProps;
