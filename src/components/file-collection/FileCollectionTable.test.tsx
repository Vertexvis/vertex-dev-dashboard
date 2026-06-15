import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { SWRConfig } from "swr";

import FileCollectionTable from "./FileCollectionTable";

const firstPage = {
  cursors: { self: "page-1", next: "page-2" },
  data: [
    {
      type: "file-collection",
      id: "collection-1",
      attributes: {
        name: "Collection One",
        suppliedId: "supplied-1",
        created: "2026-06-10T15:30:00Z",
      },
    },
  ],
  status: 200,
};

const secondPage = {
  cursors: { self: "page-2" },
  data: [
    {
      type: "file-collection",
      id: "collection-2",
      attributes: {
        name: "Collection Two",
        suppliedId: "supplied-2",
        created: "2026-06-11T15:30:00Z",
      },
    },
  ],
  status: 200,
};

describe("FileCollectionTable", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("paginates file collections using the next cursor", async () => {
    const fetchMock = mockFetch((url) =>
      url.includes("cursor=page-2") ? secondPage : firstPage
    );

    renderTable();

    expect(await screen.findByText("Collection One")).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("Go to next page"));

    expect(await screen.findByText("Collection Two")).toBeInTheDocument();
    expect(screen.queryByText("Collection One")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/file-collections?pageSize=25&cursor=page-2"
    );
  });

  it("deletes a selected file collection", async () => {
    const fetchMock = mockFetch(() => firstPage);

    renderTable();

    expect(await screen.findByText("Collection One")).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("Select Collection One"));
    await userEvent.click(screen.getByLabelText("Delete"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/file-collections", {
        body: JSON.stringify({ ids: ["collection-1"] }),
        method: "DELETE",
      });
    });
  });
});

function renderTable(): void {
  render(
    <SWRConfig
      value={{
        dedupingInterval: 0,
        fetcher: (url: string) => fetch(url).then((res) => res.json()),
        provider: () => new Map(),
      }}
    >
      <FileCollectionTable onFileCollectionSelected={jest.fn()} />
    </SWRConfig>
  );
}

function mockFetch(responseFor: (url: string) => unknown): jest.Mock {
  const fetchMock = jest.fn((input: RequestInfo | URL) => {
    const url = input.toString();

    if (url === "/api/file-collections") {
      return Promise.resolve({
        json: () => Promise.resolve({ status: 200 }),
        ok: true,
      });
    }

    return Promise.resolve({
      json: () => Promise.resolve(responseFor(url)),
      ok: true,
    });
  });

  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}
