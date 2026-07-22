/**
 * @jest-environment node
 */
import type { NextApiResponse } from "next";

import { NextIronRequest } from "../../../lib/with-session";
import { handleFileById } from "../../../pages/api/files/[id]";

const mockGetFile = jest.fn();

jest.mock("../../../lib/vertex-api", () => ({
  getClientFromSession: jest.fn(() => ({
    files: { getFile: mockGetFile },
  })),
}));

describe("file by ID route", () => {
  beforeEach(() => {
    mockGetFile.mockReset();
  });

  it("returns the requested file for detail deep links", async () => {
    const file = {
      attributes: { name: "alpha.jt", status: "complete" },
      id: "file-1",
      type: "file",
    };
    mockGetFile.mockResolvedValue({ data: { data: file } });
    const response = createResponse();

    await handleFileById(
      {
        method: "GET",
        query: { id: "file-1" },
        session: {},
      } as unknown as NextIronRequest,
      response as unknown as NextApiResponse
    );

    expect(mockGetFile).toHaveBeenCalledWith({ id: "file-1" });
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith(file);
  });

  it("rejects a request without a file ID", async () => {
    const response = createResponse();

    await handleFileById(
      {
        method: "GET",
        query: {},
        session: {},
      } as unknown as NextIronRequest,
      response as unknown as NextApiResponse
    );

    expect(mockGetFile).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(400);
  });
});

function createResponse() {
  const response = {
    json: jest.fn(),
    status: jest.fn(),
  };
  response.status.mockReturnValue(response);
  return response;
}
