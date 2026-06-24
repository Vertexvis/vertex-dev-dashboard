import { render, screen, waitFor } from "@testing-library/react";
import React from "react";

import { FileDetailsDrawer } from "../../../components/file/FileDetailsDrawer";
import { File } from "../../../lib/files";

const baseFile: File = {
  created: "2026-06-20T12:34:56.000Z",
  expiresAt: "2026-07-20T12:34:56.000Z",
  id: "file-1",
  metadata: { source: "upload" },
  name: "gear.stl",
  rootFileName: "gear.stl",
  size: 2048,
  status: "COMPLETE",
  suppliedId: "sup-123",
  type: "stl",
  uploaded: "2026-06-20T12:40:00.000Z",
};

describe("FileDetailsDrawer", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("loads associated file collection IDs only when opened and follows cursors", async () => {
    const fetchMock = mockFetch((url) =>
      url.includes("cursor=next-page")
        ? {
            cursors: { self: "page-2" },
            data: [collectionData("collection-2", "supplied-2")],
            status: 200,
          }
        : {
            cursors: { self: "page-1", next: "next-page" },
            data: [collectionData("collection-1", "supplied-1")],
            status: 200,
          }
    );

    const { rerender } = render(
      <FileDetailsDrawer file={baseFile} onClose={jest.fn()} open={false} />
    );

    expect(fetchMock).not.toHaveBeenCalled();

    rerender(
      <FileDetailsDrawer file={baseFile} onClose={jest.fn()} open={true} />
    );

    expect(await screen.findByText("collection-1")).toBeInTheDocument();
    expect(await screen.findByText("collection-2")).toBeInTheDocument();
    expect(screen.queryByText("supplied-1")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/files/file-1/file-collections?pageSize=25"
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/files/file-1/file-collections?pageSize=25&cursor=next-page"
    );
  });

  it("shows N/A when the file has no associated file collections", async () => {
    mockFetch(() => ({
      cursors: { self: "page-1" },
      data: [],
      status: 200,
    }));

    render(<FileDetailsDrawer file={baseFile} onClose={jest.fn()} open={true} />);

    expect(await screen.findByText("File Collection IDs")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByText("N/A").length).toBeGreaterThan(0);
    });
  });
});

function collectionData(id: string, suppliedId: string) {
  return {
    type: "file-collection",
    id,
    attributes: {
      created: "2026-06-10T15:30:00Z",
      name: "Collection One",
      suppliedId,
    },
  };
}

function mockFetch(responseFor: (url: string) => unknown): jest.Mock {
  const fetchMock = jest.fn((input: RequestInfo | URL) =>
    Promise.resolve({
      json: () => Promise.resolve(responseFor(input.toString())),
      ok: true,
    })
  );

  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}
