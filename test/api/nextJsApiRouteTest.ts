import type { NextApiResponse } from "next";
import type { Session } from "next-iron-session";

import {
  CredsKey,
  EnvKey,
  NetworkConfig as NetworkConfigKey,
  type NextIronRequest,
  TokenKey,
} from "../../src/lib/with-session";

type NextJsApiRouteHandler = (
  req: NextIronRequest,
  res: NextApiResponse
) => Promise<void>;

export interface ApiRouteRequest {
  readonly body?: string;
  readonly method: string;
  readonly query?: Record<string, string | string[]>;
}

export interface ApiRouteResponse {
  readonly body: () => unknown;
  readonly statusCode: () => number | undefined;
}

export async function invokeNextJsApiRouteHandler(
  handler: NextJsApiRouteHandler,
  request: ApiRouteRequest & { readonly session: Session }
): Promise<ApiRouteResponse> {
  const response = createResponse();
  await handler(createRequest(request), response as unknown as NextApiResponse);
  return response;
}

export function createAuthenticatedVertexApiTestSession(
  apiHost: string
): Session {
  const values = new Map<string, unknown>([
    [CredsKey, { id: "client-id", secret: "client-secret" }],
    [EnvKey, "custom"],
    [
      NetworkConfigKey,
      {
        apiHost,
        name: "test",
        renderingHost: "https://example.test",
        sceneTreeHost: "https://example.test",
        sceneViewHost: "https://example.test",
      },
    ],
    [
      TokenKey,
      {
        expiration: Date.now() + 60 * 60 * 1000,
        token: {
          access_token: "test-access-token",
          account_id: "account-id",
          expires_in: 60 * 60,
          scopes: [],
          token_type: "Bearer",
        },
      },
    ],
  ]);

  return {
    get: (key: string) => values.get(key),
    set: (key: string, value: unknown) => values.set(key, value),
  } as unknown as Session;
}

function createRequest({
  body,
  method,
  query = {},
  session,
}: ApiRouteRequest & { readonly session: Session }): NextIronRequest {
  return { body, method, query, session } as NextIronRequest;
}

function createResponse(): ApiRouteResponse {
  let responseBody: unknown;
  let responseStatus: number | undefined;
  const response = {
    body: () => responseBody,
    json: (body: unknown) => {
      responseBody = body;
      return response;
    },
    status: (statusCode: number) => {
      responseStatus = statusCode;
      return response;
    },
    statusCode: () => responseStatus,
  };
  return response;
}
