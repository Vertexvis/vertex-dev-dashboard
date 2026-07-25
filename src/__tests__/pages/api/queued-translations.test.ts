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
import { handleQueuedTranslationJob } from "../../../pages/api/queued-translations/[id]";

const vertexApiOrigin = "https://vertex-api.test";

describe("queued translations API routes", () => {
  it("proxies queued translation job reads with the full Vertex payload", async () => {
    nodeMswServer.use(
      http.get(`${vertexApiOrigin}/queued-translation-jobs/job-1`, () =>
        HttpResponse.json(queuedTranslationJob())
      )
    );

    const response = await callQueuedTranslationJobById("job-1", {
      method: "GET",
    });

    expect(response.statusCode()).toBe(200);
    expect(response.body()).toEqual({
      ...queuedTranslationJob(),
      status: 200,
    });
  });

  it("requires a translation job ID", async () => {
    const response = await callQueuedTranslationJobById(undefined, {
      method: "GET",
    });

    expect(response.statusCode()).toBe(400);
    expect(response.body()).toEqual({
      message: "Translation job ID required.",
      status: 400,
    });
  });

  it("rejects unsupported methods", async () => {
    const response = await callQueuedTranslationJobById("job-1", {
      method: "DELETE",
    });

    expect(response.statusCode()).toBe(405);
    expect(response.body()).toEqual({
      message: "Method not allowed.",
      status: 405,
    });
  });
});

function callQueuedTranslationJobById(
  id: string | undefined,
  req: ApiRouteRequest
): Promise<ApiRouteResponse> {
  return invokeNextJsApiRouteHandler(handleQueuedTranslationJob, {
    ...req,
    query: id == null ? req.query ?? {} : { ...req.query, id },
    session: createAuthenticatedVertexApiTestSession(vertexApiOrigin),
  });
}

function queuedTranslationJob() {
  return {
    data: {
      attributes: {
        completed: "2026-06-29T15:45:00Z",
        created: "2026-06-29T15:30:00Z",
        sourceFileName: "model.step",
        status: "complete",
      },
      id: "job-1",
      links: {
        self: { href: `${vertexApiOrigin}/queued-translation-jobs/job-1` },
      },
      relationships: {
        partRevision: { data: { id: "rev-1", type: "part-revision" } },
      },
      type: "queued-translation-job",
    },
    included: [
      {
        attributes: { suppliedId: "rev-1-supplied" },
        id: "rev-1",
        type: "part-revision",
      },
    ],
    links: {
      self: { href: `${vertexApiOrigin}/queued-translation-jobs/job-1` },
    },
  };
}
