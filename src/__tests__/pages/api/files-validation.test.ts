/**
 * @jest-environment node
 */
import type { NextApiResponse } from "next";

import { handleFiles } from "../../../lib/resources/core-import-library/files.hooks";
import { NextIronRequest } from "../../../lib/with-session";

const createFile = jest.fn();
const deleteFile = jest.fn();

jest.mock("../../../lib/vertex-api", () => ({
  getClientFromSession: jest.fn(() =>
    Promise.resolve({ files: { createFile, deleteFile } })
  ),
}));

function response(): NextApiResponse & {
  readonly body: () => unknown;
  readonly statusCode: () => number | undefined;
} {
  let body: unknown;
  let statusCode: number | undefined;
  const res = {
    body: () => body,
    json: jest.fn((value: unknown) => {
      body = value;
      return res;
    }),
    status: jest.fn((status: number) => {
      statusCode = status;
      return res;
    }),
    statusCode: () => statusCode,
  };
  return res as unknown as NextApiResponse & {
    readonly body: () => unknown;
    readonly statusCode: () => number | undefined;
  };
}

function request(method: string, body: string): NextIronRequest {
  return { body, method, query: {}, session: {} } as NextIronRequest;
}

describe("Files mutable request validation", () => {
  beforeEach(() => {
    createFile.mockReset();
    deleteFile.mockReset();
  });

  it.each([
    "{}",
    "[]",
    "null",
    '{"message":"x","status":200}',
    '{"message":"x","status":451}',
    '{"name":""}',
    '{"name":"fixture.jt","unknown":true}',
    '{"name":1}',
    '{"name":"fixture.jt","metadata":{"key":1}}',
  ])("rejects invalid create body %s without calling Vertex", async (body) => {
    const res = response();

    await handleFiles(request("POST", body), res);

    expect(res.body()).toEqual({ message: "Invalid body.", status: 400 });
    expect(res.statusCode()).toBe(400);
    expect(createFile).not.toHaveBeenCalled();
  });

  it.each([
    "{}",
    "[]",
    "null",
    '{"message":"x","status":200}',
    '{"message":"x","status":451}',
    '{"ids":[]}',
    '{"ids":[""]}',
    '{"ids":["file-1"],"unknown":true}',
  ])("rejects invalid delete body %s without calling Vertex", async (body) => {
    const res = response();

    await handleFiles(request("DELETE", body), res);

    expect(res.body()).toEqual({ message: "Invalid body.", status: 400 });
    expect(res.statusCode()).toBe(400);
    expect(deleteFile).not.toHaveBeenCalled();
  });
});
