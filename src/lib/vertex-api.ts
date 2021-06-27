import {
  ApiError,
  Failure,
  isFailure,
  logError,
  VertexClient,
} from "@vertexvis/api-client-node";
import { AxiosResponse } from "axios";
import type { NextApiResponse } from "next";

import { ErrorRes, ServerError } from "./api";
import { Config } from "./config";

export async function makeCallRes<T>(
  res: NextApiResponse<T | Failure>,
  apiCall: (client: VertexClient) => Promise<AxiosResponse<T>>
): Promise<void> {
  const result = await makeCall(apiCall);
  return isFailure(result)
    ? res.status(ServerError.status).json(result)
    : res.status(200).json(result);
}

export async function makeCall<T>(
  apiCall: (client: VertexClient) => Promise<AxiosResponse<T>>
): Promise<T | Failure> {
  try {
    const c = await getClient();
    return (await apiCall(c)).data;
  } catch (error) {
    logError(error);
    return error.vertexError?.res ?? toFailure(ServerError);
  }
}

let Client: VertexClient | undefined;
export async function getClient(): Promise<VertexClient> {
  if (Client != null) return Client;

  Client = await VertexClient.build({
    basePath:
      Config.vertexEnv === "platprod"
        ? "https://platform.vertexvis.com"
        : `https://platform.${Config.vertexEnv}.vertexvis.io`,
    client: {
      id: process.env.VERTEX_CLIENT_ID ?? "",
      secret: process.env.VERTEX_CLIENT_SECRET ?? "",
    },
  });

  return Client;
}

export function toFailure({ message, status }: ErrorRes): Failure {
  const es = new Set<ApiError>();
  es.add({ status: status.toString(), title: message });
  return { errors: es };
}
