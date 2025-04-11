import dynamic from "next/dynamic";
import React from "react";

import { Layout } from "../components/shared/Layout";
import { defaultServerSideProps } from "../lib/with-session";

const TranslationTable = dynamic(() => import("../components/translation/TranslationTable"), {
  ssr: false,
});

export default function Translations(): JSX.Element {
  return <Layout main={<TranslationTable />} />;
}

export const getServerSideProps = defaultServerSideProps;
