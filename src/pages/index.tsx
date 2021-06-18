import { GetServerSidePropsContext } from "next";
import React from "react";

import { Header } from "../components/Header";
import { Layout } from "../components/Layout";
import { LeftDrawer } from "../components/LeftDrawer";
import { SceneTable } from "../components/SceneTable";
import { Paged, Scene, toSceneData } from "../lib/scenes";
import { isErrorRes } from "./api/scenes";

interface Props {
  readonly baseUrl: string;
  readonly page: Paged<Scene>;
}

export async function getServerSideProps(
  context: GetServerSidePropsContext
): Promise<{ props: Props }> {
  const empty = { props: { baseUrl: "", page: { cursor: null, items: [] } } };
  const host = context.req.headers.host;
  if (!host) return empty;

  const baseUrl = `http${host.startsWith("localhost") ? "" : "s"}://${host}`;
  const res = await fetch(`${baseUrl}/api/scenes`);
  const json = await res.json();
  return isErrorRes(json)
    ? empty
    : { props: { baseUrl, page: toSceneData(json) } };
}

export default function Home({ baseUrl, page }: Props): JSX.Element {
  return (
    <Layout
      header={<Header />}
      leftDrawer={<LeftDrawer />}
      main={<SceneTable baseUrl={baseUrl} page={page} />}
    />
  );
}
