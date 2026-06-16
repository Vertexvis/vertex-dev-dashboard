import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { SWRConfig } from "swr";

import FileCollectionTable from "../../../components/file-collection/FileCollectionTable";

const firstPage = {
  cursors: { self: "page-1", next: "page+2&filter=unexpected#fragment" },
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

const multiCollectionPage = {
  cursors: { self: "page-1" },
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
      url.includes("cursor=page%2B2%26filter%3Dunexpected%23fragment")
        ? secondPage
        : firstPage
    );

    renderTable();

    expect(await screen.findByText("Collection One")).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("Go to next page"));

    expect(await screen.findByText("Collection Two")).toBeInTheDocument();
    expect(screen.queryByText("Collection One")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/file-collections?pageSize=25&cursor=page%2B2%26filter%3Dunexpected%23fragment"
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

  it("shows an error banner when deleting a file collection fails", async () => {
    mockFetch(() => firstPage, {
      body: { message: "Could not delete collection-1." },
      ok: false,
    });

    renderTable();

    expect(await screen.findByText("Collection One")).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("Select Collection One"));
    await userEvent.click(screen.getByLabelText("Delete"));

    expect(
      await screen.findByText("Could not delete collection-1.")
    ).toBeInTheDocument();
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(screen.getByLabelText("Select Collection One")).toBeChecked();
  });

  it("selects and clears all file collections on the current page", async () => {
    mockFetch(() => multiCollectionPage);

    renderTable();

    expect(await screen.findByText("Collection One")).toBeInTheDocument();
    expect(screen.getByText("Collection Two")).toBeInTheDocument();

    const selectAll = screen.getAllByRole("checkbox")[0];

    await userEvent.click(selectAll);

    expect(screen.getByText("2 selected")).toBeInTheDocument();
    expect(screen.getByLabelText("Select Collection One")).toBeChecked();
    expect(screen.getByLabelText("Select Collection Two")).toBeChecked();

    await userEvent.click(selectAll);

    expect(screen.getByText("File Collections")).toBeInTheDocument();
    expect(screen.getByLabelText("Select Collection One")).not.toBeChecked();
    expect(screen.getByLabelText("Select Collection Two")).not.toBeChecked();
  });

  it("filters file collections by supplied ID", async () => {
    const fetchMock = mockFetch((url) =>
      url.includes("suppliedId=supplied-2") ? secondPage : firstPage
    );

    renderTable();

    expect(await screen.findByText("Collection One")).toBeInTheDocument();

    await userEvent.type(
      screen.getByLabelText("Supplied ID Filter (exact)"),
      "supplied-2"
    );

    expect(await screen.findByText("Collection Two")).toBeInTheDocument();
    expect(screen.queryByText("Collection One")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/file-collections?pageSize=25&suppliedId=supplied-2"
      );
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

function mockFetch(
  responseFor: (url: string) => unknown,
  deleteResponse: { body: unknown; ok: boolean } = {
    body: { status: 200 },
    ok: true,
  }
): jest.Mock {
  const fetchMock = jest.fn((input: RequestInfo | URL) => {
    const url = input.toString();

    if (url === "/api/file-collections") {
      return Promise.resolve({
        json: () => Promise.resolve(deleteResponse.body),
        ok: deleteResponse.ok,
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
