import { signIn, useSession } from "next-auth/client";
import React from "react";

import { Header } from "../components/Header";
import { Layout } from "../components/Layout";
import { LeftDrawer } from "../components/LeftDrawer";
import { SceneTable } from "../components/SceneTable";

export default function Home(): JSX.Element {
  const [session, loading] = useSession();
  return (
    <>
      {!loading && !session && (
        <>
          Not signed in <br />
          <button onClick={() => signIn()}>Sign in</button>
        </>
      )}

      {!!session && (
        <Layout
          header={<Header />}
          leftDrawer={<LeftDrawer />}
          leftDrawerOpen
          main={<SceneTable />}
        />
      )}
    </>
  );
}
