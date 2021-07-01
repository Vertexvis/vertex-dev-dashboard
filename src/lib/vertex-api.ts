import {
  ApiError,
  Configuration,
  Failure,
  isFailure,
  logError,
  Oauth2Api,
  OAuth2Token,
  VertexClient,
} from "@vertexvis/api-client-node";
import { AxiosResponse } from "axios";
import type { NextApiResponse } from "next";
import { Session } from "next-iron-session";

import { ErrorRes, ServerError } from "./api";
import { Config } from "./config";
import { OAuthCredentials, SessionToken } from "./with-session";

const basePath =
  Config.vertexEnv === "platprod"
    ? "https://platform.vertexvis.com"
    : `https://platform.${Config.vertexEnv}.vertexvis.io`;

export async function makeCallRes<T>(
  res: NextApiResponse<T | Failure>,
  apiCall: () => Promise<AxiosResponse<T>>
): Promise<void> {
  const result = await makeCall(apiCall);
  return isFailure(result)
    ? res.status(ServerError.status).json(result)
    : res.status(200).json(result);
}

export async function makeCall<T>(
  apiCall: () => Promise<AxiosResponse<T>>
): Promise<T | Failure> {
  try {
    return (await apiCall()).data;
  } catch (error) {
    logError(error);
    return error.vertexError?.res ?? toFailure(ServerError);
  }
}

let Client: VertexClient | undefined;
export async function getClient(): Promise<VertexClient> {
  if (Client != null) return Client;

  Client = await VertexClient.build({
    basePath,
    client: {
      id: process.env.VERTEX_CLIENT_ID ?? "",
      secret: process.env.VERTEX_CLIENT_SECRET ?? "",
    },
  });

  return Client;
}

export async function getToken(
  id: string,
  secret: string
): Promise<OAuth2Token> {
  const auth = new Oauth2Api(
    new Configuration({
      basePath,
      username: id,
      password: secret,
    }),
    basePath
  );

  return (await auth.createToken({ grantType: "client_credentials" })).data;
}

export async function getClientWithCreds(
  id: string,
  secret: string,
  token: OAuth2Token
): Promise<VertexClient> {
  const client = await VertexClient.build({
    basePath,
    client: {
      id,
      secret,
    },
    initialToken: token,
  });

  return client;
}

export function getClientFromSession(session: Session): Promise<VertexClient> {
  const token = session.get("token") as SessionToken;
  const creds = session.get("creds") as OAuthCredentials;

  return getClientWithCreds(creds.id, creds.secret, {
    ...token.token,
    expires_in: token.expiration - Date.now()
  });
}

export function toFailure({ message, status }: ErrorRes): Failure {
  const es = new Set<ApiError>();
  es.add({ status: status.toString(), title: message });
  return { errors: es };
}
