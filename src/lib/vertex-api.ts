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
import assert from "assert";
import { AxiosResponse } from "axios";
import type { NextApiResponse } from "next";
import { Session } from "next-iron-session";

import { ErrorRes, ServerError } from "./api";
import {
  getCreds,
  getEnv,
  getToken as getSessionToken,
  setToken,
} from "./with-session";

const TenMinsInMs = 600_000;

const basePath = (env: string) =>
  env === "platprod"
    ? "https://platform.vertexvis.com"
    : `https://platform.${env}.vertexvis.io`;

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

export async function getToken(
  id: string,
  secret: string,
  env: string
): Promise<OAuth2Token> {
  const auth = new Oauth2Api(
    new Configuration({
      basePath: basePath(env),
      username: id,
      password: secret,
    }),
    basePath(env)
  );

  return (await auth.createToken({ grantType: "client_credentials" })).data;
}

export async function getClientWithCreds(
  id: string,
  secret: string,
  env: string,
  token: OAuth2Token
): Promise<VertexClient> {
  const client = await VertexClient.build({
    basePath: basePath(env),
    client: {
      id,
      secret,
    },
    initialToken: token,
  });

  return client;
}

export async function getClientFromSession(
  session: Session
): Promise<VertexClient> {
  const creds = getCreds(session);
  const env = getEnv(session);
  const token = getSessionToken(session);
  assert(creds != null);
  assert(env != null);
  assert(token != null);

  const expiresIn = token.expiration - Date.now();
  if (expiresIn < TenMinsInMs) {
    const newToken = await getToken(creds.id, creds.secret, env);
    const newExpiration = Date.now() + newToken.expires_in * 1000;

    setToken(session, { token: newToken, expiration: newExpiration });
    return getClientWithCreds(creds.id, creds.secret, env, {
      ...newToken,
      expires_in: newExpiration,
    });
  }

  return getClientWithCreds(creds.id, creds.secret, env, {
    ...token.token,
    expires_in: expiresIn,
  });
}

export function toFailure({ message, status }: ErrorRes): Failure {
  const es = new Set<ApiError>();
  es.add({ status: status.toString(), title: message });
  return { errors: es };
}
