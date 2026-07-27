/**
 * @jest-environment node
 */
import { http, HttpResponse } from "msw";

import {
  type ApiRouteRequest,
  type ApiRouteResponse,
  createAuthenticatedVertexApiTestSession,
  invokeNextJsApiRouteHandler,
} from "../../../../test/api/nextJsApiRouteTest";
import { nodeMswServer } from "../../../../test/msw/server";
import { handleStreamKeys } from "../../../pages/api/stream-keys";

const vertexApiOrigin = "https://vertex-api.test";
const sceneId = "scene-abc";

describe("stream-keys API route", () => {
  it("forwards propertyKeyPolicyId to the upstream request when provided", async () => {
    let capturedBody: unknown;
    nodeMswServer.use(
      http.post(
        `${vertexApiOrigin}/scenes/${sceneId}/stream-keys`,
        async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json(streamKeyResponse("key-with-policy"));
        }
      )
    );

    const response = await callStreamKeys({
      body: JSON.stringify({ id: sceneId, propertyKeyPolicyId: "policy-1" }),
      method: "POST",
    });

    expect(response.statusCode()).toBe(200);
    expect(response.body()).toEqual({ key: "key-with-policy", status: 200 });
    expect(capturedBody).toEqual({
      data: {
        type: "stream-key",
        attributes: {
          expiry: 86400,
          propertyKeyPolicyId: "policy-1",
        },
      },
    });
  });

  it("omits propertyKeyPolicyId from the upstream request when not provided", async () => {
    let capturedBody: unknown;
    nodeMswServer.use(
      http.post(
        `${vertexApiOrigin}/scenes/${sceneId}/stream-keys`,
        async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json(streamKeyResponse("key-without-policy"));
        }
      )
    );

    const response = await callStreamKeys({
      body: JSON.stringify({ id: sceneId }),
      method: "POST",
    });

    expect(response.statusCode()).toBe(200);
    expect(response.body()).toEqual({ key: "key-without-policy", status: 200 });
    expect(capturedBody).toEqual({
      data: {
        type: "stream-key",
        attributes: {
          expiry: 86400,
        },
      },
    });
    expect(
      (capturedBody as { data: { attributes: Record<string, unknown> } }).data
        .attributes
    ).not.toHaveProperty("propertyKeyPolicyId");
  });
});

function callStreamKeys(req: ApiRouteRequest): Promise<ApiRouteResponse> {
  return invokeNextJsApiRouteHandler(handleStreamKeys, {
    ...req,
    session: createAuthenticatedVertexApiTestSession(vertexApiOrigin),
  });
}

function streamKeyResponse(key: string) {
  return {
    data: {
      attributes: { key },
      id: "stream-key-id",
      type: "stream-key",
    },
  };
}
