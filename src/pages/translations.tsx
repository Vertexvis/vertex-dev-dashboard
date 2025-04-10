import dynamic from "next/dynamic";
import React from "react";

import { Layout } from "../components/shared/Layout";
import { defaultServerSideProps } from "../lib/with-session";

const TranslationTables = dynamic(
  () => import("../components/translation/TranslationTables"),
  {
    ssr: false,
  }
);

export default function Translations(): JSX.Element {
  return <Layout main={<TranslationTables />} />;
}

export const getServerSideProps = defaultServerSideProps;
