import React from "react";

import { PropertiesSearchPage } from "../components/properties-search/PropertiesSearchPage";
import { Layout } from "../components/shared/Layout";
import { defaultServerSideProps } from "../lib/with-session";

export default function PropertiesSearch(): JSX.Element {
  return <Layout main={<PropertiesSearchPage />} />;
}

export const getServerSideProps = defaultServerSideProps;
