import dynamic from "next/dynamic";
import React from "react";

import { PropertyKeyPolicyDetailsDrawer } from "../components/property-key-policy/PropertyKeyPolicyDetailsDrawer";
import { Layout } from "../components/shared/Layout";
import { PropertyKeyPolicy } from "../lib/property-key-policies";

export { defaultServerSideProps as getServerSideProps } from "../lib/with-session";

const PropertyKeyPolicyTable = dynamic(
  () => import("../components/property-key-policy/PropertyKeyPolicyTable"),
  {
    ssr: false,
  }
);

export default function PropertyKeyPolicies(): JSX.Element {
  const [propertyKeyPolicy, setPropertyKeyPolicy] = React.useState<
    PropertyKeyPolicy | undefined
  >();
  const drawerOpen = Boolean(propertyKeyPolicy);

  return (
    <Layout
      main={
        <PropertyKeyPolicyTable
          activePropertyKeyPolicyId={propertyKeyPolicy?.id}
          onPoliciesDeleted={(ids) => {
            if (propertyKeyPolicy != null && ids.includes(propertyKeyPolicy.id))
              setPropertyKeyPolicy(undefined);
          }}
          onPropertyKeyPolicySelected={setPropertyKeyPolicy}
        />
      }
      rightDrawer={
        <PropertyKeyPolicyDetailsDrawer
          onClose={() => setPropertyKeyPolicy(undefined)}
          open={drawerOpen}
          propertyKeyPolicy={propertyKeyPolicy}
        />
      }
      rightDrawerOpen={drawerOpen}
    />
  );
}
