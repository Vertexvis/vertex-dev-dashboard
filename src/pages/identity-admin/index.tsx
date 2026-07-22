import React from "react";

import { IdentityAdminPage } from "../../components/identity-admin/IdentityAdminPage";
import { Layout } from "../../components/shared/Layout";
import { defaultServerSideProps } from "../../lib/with-session";

export default function IdentityAdmin(): JSX.Element {
  return <Layout main={<IdentityAdminPage />} />;
}

export const getServerSideProps = defaultServerSideProps;
