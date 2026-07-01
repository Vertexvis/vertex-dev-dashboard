/**
 * @jest-environment node
 */
import { getPage } from "@vertexvis/api-client-node";
import type { NextApiResponse } from "next";
import type { Session } from "next-iron-session";

import type { NextIronRequest } from "../../../lib/with-session";
import { handleFileJobs } from "../../../pages/api/file-jobs";
import { handleFileJob } from "../../../pages/api/file-jobs/[id]";

const mockGetClientFromSession = jest.fn();
const mockGetFileCollectionsApi = jest.fn();
const mockGetFileJobsApi = jest.fn();
const mockListFileCollectionFiles = jest.fn();
const mockCreateFile = jest.fn();
const mockCreateFileJob = jest.fn();
const mockGetFileJob = jest.fn();
const mockGetPage = getPage as jest.Mock;

jest.mock("@vertexvis/api-client-node", () => {
  const actual = jest.requireActual("@vertexvis/api-client-node");
  return {
    ...actual,
    getPage: jest.fn(),
    logError: jest.fn(),
  };
});

jest.mock("../../../lib/vertex-api", () => {
  const actual = jest.requireActual("../../../lib/vertex-api");
  return {
    ...actual,
    getClientFromSession: (...args: unknown[]) =>
      mockGetClientFromSession(...args),
  };
});

jest.mock("../../../lib/file-collections", () => {
  const actual = jest.requireActual("../../../lib/file-collections");
  return {
    ...actual,
    getFileCollectionsApi: (...args: unknown[]) =>
      mockGetFileCollectionsApi(...args),
  };
});

jest.mock("../../../lib/file-jobs", () => {
  const actual = jest.requireActual("../../../lib/file-jobs");
  return {
    ...actual,
    getFileJobsApi: (...args: unknown[]) => mockGetFileJobsApi(...args),
  };
});

type TestReq = Pick<NextIronRequest, "body" | "method" | "query" | "session">;

interface TestRes extends Pick<NextApiResponse, "json" | "status"> {
  body: () => unknown;
  statusCode: () => number | undefined;
}

describe("file jobs API routes", () => {
  beforeEach(() => {
    mockGetClientFromSession.mockResolvedValue({
      client: "test-client",
      files: { createFile: mockCreateFile },
    });
    mockGetFileCollectionsApi.mockReturnValue({
      listFileCollectionFiles: mockListFileCollectionFiles,
    });
    mockGetFileJobsApi.mockReturnValue({
      createFileJob: mockCreateFileJob,
      getFileJob: mockGetFileJob,
    });
    mockCreateFileJob.mockResolvedValue({
      data: queuedJob("job-1", { links: { archive: { href: "https://zip" } } }),
    });
    mockCreateFile.mockResolvedValue({
      data: { data: fileData("archive-file-1", "created") },
    });
    mockGetFileJob.mockResolvedValue({
      data: queuedJob("job-1", {
        links: { download: { href: "https://zip" } },
      }),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("creates an output file and archive job with every collection file ID", async () => {
    mockGetPage.mockImplementation(async (apiCall) => {
      await apiCall();
      const lastCall =
        mockListFileCollectionFiles.mock.calls[
          mockListFileCollectionFiles.mock.calls.length - 1
        ][0];

      return lastCall.pageCursor == null
        ? {
            cursors: { next: "cursor-2", self: "cursor-1" },
            page: {
              data: [
                fileData("file-1", "completed"),
                fileData("file-2", "ready"),
              ],
            },
          }
        : {
            cursors: { next: undefined, self: "cursor-2" },
            page: { data: [fileData("file-3", "complete")] },
          };
    });

    const res = await callFileJobs({
      body: JSON.stringify({ fileCollectionId: "collection-1" }),
      method: "POST",
    });

    expect(mockListFileCollectionFiles).toHaveBeenCalledTimes(2);
    expect(mockListFileCollectionFiles).toHaveBeenNthCalledWith(1, {
      id: "collection-1",
      pageCursor: undefined,
      pageSize: 200,
    });
    expect(mockListFileCollectionFiles).toHaveBeenNthCalledWith(2, {
      id: "collection-1",
      pageCursor: "cursor-2",
      pageSize: 200,
    });
    expect(mockCreateFile).toHaveBeenCalledWith({
      createFileRequest: {
        data: {
          attributes: {
            metadata: { fileCollectionId: "collection-1" },
            name: "file-collection-collection-1.zip",
          },
          type: "file",
        },
      },
    });
    expect(mockCreateFileJob).toHaveBeenCalledWith({
      createFileJobRequest: {
        data: {
          attributes: {
            operation: {
              fileId: "archive-file-1",
              manifest: [
                { selector: { id: "file-1", type: "file-by-id" } },
                { selector: { id: "file-2", type: "file-by-id" } },
                { selector: { id: "file-3", type: "file-by-id" } },
              ],
              type: "file-archive-operation",
            },
          },
          type: "file-job",
        },
      },
    });
    expect(res.statusCode()).toBe(201);
    expect(res.body()).toEqual({
      archiveFileId: "archive-file-1",
      data: queuedJob("job-1", {
        links: { archive: { href: "https://zip" } },
      }).data,
      status: 201,
    });
  });

  it("uses an optional archive name when creating the output file", async () => {
    mockGetPage.mockImplementation(async (apiCall) => {
      await apiCall();
      return {
        cursors: { next: undefined, self: undefined },
        page: { data: [fileData("file-1", "completed")] },
      };
    });

    const res = await callFileJobs({
      body: JSON.stringify({
        archiveName: "Custom collection.zip",
        fileCollectionId: "collection-1",
      }),
      method: "POST",
    });

    expect(mockCreateFile).toHaveBeenCalledWith({
      createFileRequest: {
        data: {
          attributes: {
            metadata: { fileCollectionId: "collection-1" },
            name: "Custom collection.zip",
          },
          type: "file",
        },
      },
    });
    expect(res.body()).toMatchObject({
      archiveFileId: "archive-file-1",
      status: 201,
    });
  });

  it("rejects zero-file collections before creating a job", async () => {
    mockGetPage.mockImplementation(async (apiCall) => {
      await apiCall();
      return {
        cursors: { next: undefined, self: undefined },
        page: { data: [] },
      };
    });

    const res = await callFileJobs({
      body: JSON.stringify({ fileCollectionId: "collection-1" }),
      method: "POST",
    });

    expect(res.statusCode()).toBe(400);
    expect(res.body()).toEqual({
      message: "File collection has no files to export.",
      status: 400,
    });
    expect(mockCreateFile).not.toHaveBeenCalled();
    expect(mockCreateFileJob).not.toHaveBeenCalled();
  });

  it("rejects collections containing incomplete files", async () => {
    mockGetPage.mockImplementation(async (apiCall) => {
      await apiCall();
      return {
        cursors: { next: undefined, self: undefined },
        page: {
          data: [fileData("file-1", "COMPLETED"), fileData("file-2", "queued")],
        },
      };
    });

    const res = await callFileJobs({
      body: JSON.stringify({ fileCollectionId: "collection-1" }),
      method: "POST",
    });

    expect(res.statusCode()).toBe(400);
    expect(res.body()).toEqual({
      message: "File collection contains files that are not ready to export.",
      status: 400,
    });
    expect(mockCreateFile).not.toHaveBeenCalled();
    expect(mockCreateFileJob).not.toHaveBeenCalled();
  });

  it("proxies file job reads", async () => {
    const res = await callFileJobById({
      method: "GET",
      query: { id: "job-1" },
    });

    expect(mockGetFileJob).toHaveBeenCalledWith({ id: "job-1" });
    expect(res.statusCode()).toBe(200);
    expect(res.body()).toEqual({
      data: queuedJob("job-1", {
        links: { download: { href: "https://zip" } },
      }).data,
      status: 200,
    });
  });

  it("validates file job requests before calling Vertex", async () => {
    const missingBody = await callFileJobs({ method: "POST" });
    const invalidBody = await callFileJobs({
      body: "{}",
      method: "POST",
    });
    const missingId = await callFileJobById({
      method: "GET",
      query: {},
    });
    const unsupportedMethod = await callFileJobById({
      method: "DELETE",
      query: { id: "job-1" },
    });

    expect(missingBody.statusCode()).toBe(400);
    expect(missingBody.body()).toEqual({
      message: "Body required.",
      status: 400,
    });
    expect(invalidBody.statusCode()).toBe(400);
    expect(invalidBody.body()).toEqual({
      message: "Invalid body.",
      status: 400,
    });
    expect(missingId.statusCode()).toBe(400);
    expect(missingId.body()).toEqual({
      message: "File Job ID required.",
      status: 400,
    });
    expect(unsupportedMethod.statusCode()).toBe(405);
    expect(unsupportedMethod.body()).toEqual({
      message: "Method not allowed.",
      status: 405,
    });
    expect(mockGetClientFromSession).not.toHaveBeenCalled();
  });
});

function callFileJobs(req: {
  readonly body?: string;
  readonly method: string;
  readonly query?: Record<string, string | string[]>;
}): Promise<TestRes> {
  return callApi((r, res) => handleFileJobs(r, res), req);
}

function callFileJobById(req: {
  readonly body?: string;
  readonly method: string;
  readonly query?: Record<string, string | string[]>;
}): Promise<TestRes> {
  return callApi((r, res) => handleFileJob(r, res), req);
}

async function callApi(
  handler: (req: NextIronRequest, res: NextApiResponse) => Promise<void>,
  req: {
    readonly body?: string;
    readonly method: string;
    readonly query?: Record<string, string | string[]>;
  }
): Promise<TestRes> {
  const res = createRes();
  await handler(createReq(req), res as unknown as NextApiResponse);
  return res;
}

function createReq({
  body,
  method,
  query = {},
}: {
  readonly body?: string;
  readonly method: string;
  readonly query?: Record<string, string | string[]>;
}): NextIronRequest {
  const req: TestReq = {
    body,
    method,
    query,
    session: {} as Session,
  };
  return req as NextIronRequest;
}

function createRes(): TestRes {
  let responseBody: unknown;
  let responseStatus: number | undefined;
  const res = {} as TestRes;
  res.body = () => responseBody;
  res.statusCode = () => responseStatus;
  res.status = jest.fn((statusCode: number): NextApiResponse => {
    responseStatus = statusCode;
    return res as unknown as NextApiResponse;
  });
  res.json = jest.fn((body: unknown): NextApiResponse => {
    responseBody = body;
    return res as unknown as NextApiResponse;
  });
  return res;
}

function queuedJob(
  id: string,
  dataOverrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    data: {
      attributes: {
        created: "2026-06-29T15:30:00Z",
        status: "running",
      },
      id,
      type: "queued-job",
      ...dataOverrides,
    },
  };
}

function fileData(id: string, status: string): Record<string, unknown> {
  return {
    attributes: {
      created: "2026-06-12T15:30:00Z",
      name: `${id}.jt`,
      status,
      suppliedId: `${id}-supplied`,
      uploaded: "2026-06-12T15:31:00Z",
    },
    id,
    type: "file",
  };
}
