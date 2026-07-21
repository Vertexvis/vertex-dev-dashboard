/**
 * @jest-environment node
 */
import type { NextApiResponse } from "next";

import { NextIronRequest } from "../../../lib/with-session";
import { handleFileDownload } from "../../../pages/api/files/[id]/download";

const mockCreateDownloadUrl = jest.fn();

jest.mock("../../../lib/vertex-api", () => ({
  getClientFromSession: jest.fn(() => ({
    files: { createDownloadUrl: mockCreateDownloadUrl },
  })),
}));

describe("file download route", () => {
  beforeEach(() => {
    mockCreateDownloadUrl.mockReset();
  });

  it("redirects a file href to the generated download URL", async () => {
    mockCreateDownloadUrl.mockResolvedValue({
      data: {
        data: { attributes: { uri: "https://downloads.example.test/file-1" } },
      },
    });
    const res = createResponse();

    await handleFileDownload(
      {
        method: "GET",
        query: { id: "file-1" },
        session: {},
      } as NextIronRequest,
      res as unknown as NextApiResponse
    );

    expect(mockCreateDownloadUrl).toHaveBeenCalledWith({
      id: "file-1",
      createDownloadRequest: {
        data: {
          type: "download-url",
          attributes: { expiry: 30 },
        },
      },
    });
    expect(res.redirect).toHaveBeenCalledWith(
      302,
      "https://downloads.example.test/file-1"
    );
  });
});

function createResponse() {
  const res = {
    json: jest.fn(),
    redirect: jest.fn(),
    status: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
}
