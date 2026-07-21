/**
 * @jest-environment node
 */
import type { NextApiResponse } from "next";
import type { Session } from "next-iron-session";

import type { NextIronRequest } from "../../../lib/with-session";
import { handleParts } from "../../../pages/api/parts";

const mockGetClientFromSession = jest.fn();
const mockCreatePart = jest.fn();
const mockDeletePart = jest.fn();

jest.mock("../../../lib/vertex-api", () => {
  const actual = jest.requireActual("../../../lib/vertex-api");
  return {
    ...actual,
    getClientFromSession: (...args: unknown[]) =>
      mockGetClientFromSession(...args),
  };
});

describe("parts API route validation", () => {
  beforeEach(() => {
    mockGetClientFromSession.mockResolvedValue({
      parts: { createPart: mockCreatePart, deletePart: mockDeletePart },
    });
    mockCreatePart.mockResolvedValue({ data: { data: { id: "part-1" } } });
    mockDeletePart.mockResolvedValue({ data: {} });
  });

  afterEach(() => jest.clearAllMocks());

  it.each([
    undefined,
    "not-json",
    JSON.stringify({}),
    JSON.stringify({ fileId: "" }),
    JSON.stringify({ fileId: "file-1", indexMetadata: "yes" }),
  ])("does not create a part for an invalid body", async (body) => {
    const res = await callParts({ body, method: "POST" });

    expect(res.statusCode()).toBe(400);
    expect(res.body()).toEqual({ message: expect.any(String), status: 400 });
    expect(mockGetClientFromSession).not.toHaveBeenCalled();
    expect(mockCreatePart).not.toHaveBeenCalled();
  });

  it("uses the typed source relationship for a validated part request", async () => {
    const res = await callParts({
      body: JSON.stringify({
        fileId: "file-1",
        indexMetadata: true,
        suppliedId: "part-a",
        suppliedRevisionId: "revision-a",
      }),
      method: "POST",
    });

    expect(mockCreatePart).toHaveBeenCalledWith({
      createPartRequest: {
        data: {
          attributes: {
            indexMetadata: true,
            suppliedId: "part-a",
            suppliedIterationId: undefined,
            suppliedRevisionId: "revision-a",
          },
          relationships: { source: { data: { id: "file-1", type: "file" } } },
          type: "part",
        },
      },
    });
    expect(res.body()).toEqual({ id: "part-1", status: 200 });
  });

  it("maps a Part creation failure to the standard error envelope", async () => {
    mockCreatePart.mockRejectedValue({
      response: {
        data: { errors: [{ status: "409", title: "Part already exists." }] },
      },
    });

    const res = await callParts({
      body: JSON.stringify({ fileId: "file-1" }),
      method: "POST",
    });

    expect(res.statusCode()).toBe(409);
    expect(res.body()).toEqual({
      message: "Part already exists.",
      status: 409,
    });
  });

  it("does not delete parts for an invalid delete body", async () => {
    const res = await callParts({
      body: JSON.stringify({ ids: [] }),
      method: "DELETE",
    });

    expect(res.statusCode()).toBe(400);
    expect(mockGetClientFromSession).not.toHaveBeenCalled();
    expect(mockDeletePart).not.toHaveBeenCalled();
  });

  it("maps a failed Part deletion instead of reporting success", async () => {
    mockDeletePart.mockRejectedValue({
      response: {
        data: { errors: [{ status: "404", title: "Part not found." }] },
      },
    });

    const res = await callParts({
      body: JSON.stringify({ ids: ["part-1"] }),
      method: "DELETE",
    });

    expect(res.statusCode()).toBe(404);
    expect(res.body()).toEqual({ message: "Part not found.", status: 404 });
  });

  it("returns a non-success result when one bulk Part deletion fails", async () => {
    mockDeletePart.mockImplementation(({ id }: { id: string }) =>
      id === "part-2"
        ? Promise.reject({
            response: {
              data: { errors: [{ status: "500", title: "Delete failed." }] },
            },
          })
        : Promise.resolve({ data: {} })
    );

    const res = await callParts({
      body: JSON.stringify({ ids: ["part-1", "part-2"] }),
      method: "DELETE",
    });

    expect(mockDeletePart).toHaveBeenCalledTimes(2);
    expect(res.statusCode()).toBe(500);
    expect(res.body()).toEqual({ message: "Delete failed.", status: 500 });
  });
});

interface TestRes extends Pick<NextApiResponse, "json" | "status"> {
  readonly body: () => unknown;
  readonly statusCode: () => number | undefined;
}

async function callParts({
  body,
  method,
}: {
  readonly body?: string;
  readonly method: string;
}): Promise<TestRes> {
  const res = createRes();
  await handleParts(
    {
      body,
      method,
      query: {},
      session: {} as Session,
    } as NextIronRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

function createRes(): TestRes {
  let responseBody: unknown;
  let responseStatus: number | undefined;
  const res = {} as TestRes;
  res.body = () => responseBody;
  res.statusCode = () => responseStatus;
  res.status = jest.fn((statusCode: number) => {
    responseStatus = statusCode;
    return res;
  });
  res.json = jest.fn((body: unknown) => {
    responseBody = body;
    return res;
  });
  return res;
}
