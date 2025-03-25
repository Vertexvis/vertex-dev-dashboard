import {
  getPage,
  logError,
  SceneData,
  VertexClient,
  VertexError,
} from "@vertexvis/api-client-node";
import { Environment } from "@vertexvis/viewer";
import { GetServerSidePropsResult } from "next";
import React from "react";

import { getClientFromSession } from "../lib/vertex-api";
import withSession, {
  CredsKey,
  EnvKey,
  NextIronRequest,
  OAuthCredentials,
} from "../lib/with-session";

export default function SceneViewerBySuppliedId(): JSX.Element {
  return <></>;
}

export const getServerSideProps = withSession(serverSidePropsHandler);

export async function serverSidePropsHandler(
  req: NextIronRequest
): Promise<GetServerSidePropsResult<unknown>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = (req as any).req.session;
  const creds: OAuthCredentials | undefined = session.get(CredsKey);
  const vertexEnv: Environment = session.get(EnvKey) || "platdev";
  const { query } = req;

  if (session == null || creds == null) {
    return { redirect: { statusCode: 302, destination: "/login" } };
  }

  if (query["sceneSuppliedId"] != null) {
    const sceneSuppliedId = query["sceneSuppliedId"] as string;

    try {
      const c = await getClientFromSession(session);
      const sceneToLoad = await fetchSceneBySuppliedId(c, sceneSuppliedId);

      if (sceneToLoad != null) {
        const keyRes = await c.streamKeys.createSceneStreamKey({
          id: sceneToLoad.id,
          createStreamKeyRequest: {
            data: { type: "stream-key", attributes: { expiry: 86400, withSearchSession: true} },
          },
        });

        // return {

        // }
        // return {
        //   redirect: {
        //     statusCode: 307,
        //     destination: `/scene-viewer/${sceneToLoad.id}?clientId=${creds.id}&streamKey=${keyRes.data.data.attributes.key}&vertexEnv=${vertexEnv}`,
        //   },
        // };
      }
    } catch (error) {
      const e = error as VertexError;
      logError(e);
    }
  }

  return { redirect: { statusCode: 307, destination: "/" } };
}

async function fetchSceneBySuppliedId(
  client: VertexClient,
  nameFilter: string,
  pageNumber = 0,
  cursor?: string
): Promise<SceneData | undefined> {
  if (pageNumber >= 10) {
    throw new Error(`Failed to find requested scene in the first ten pages.`);
  }

  const { cursors, page } = await getPage(() =>
    client.scenes.getScenes({
      pageCursor: cursor,
      pageSize: 50,
    })
  );

  const scene = page.data.find(
    (s) =>
      s.attributes.name?.includes(nameFilter) ||
      s.attributes.name?.toLowerCase().includes(nameFilter)
  );

  if (scene != null) {
    return scene;
  } else {
    return fetchSceneBySuppliedId(
      client,
      nameFilter,
      pageNumber + 1,
      cursors.next
    );
  }
}
