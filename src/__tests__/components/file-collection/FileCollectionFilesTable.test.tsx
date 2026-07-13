import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import nodeFetch, { Headers, Request, Response } from "node-fetch";
import React from "react";
import { SWRConfig } from "swr";

import FileCollectionFilesTable from "../../../components/file-collection/FileCollectionFilesTable";

const collectionFilesPage = {
  cursors: { self: "page-1" },
  data: [
    {
      type: "file",
      id: "file-1",
      attributes: {
        name: "File One",
        status: "complete",
        suppliedId: "supplied-file-1",
        created: "2026-06-12T15:30:00Z",
        uploaded: "2026-06-12T15:31:00Z",
      },
    },
  ],
  status: 200,
};

describe("FileCollectionFilesTable", () => {
  beforeAll(() => {
    Object.assign(global, {
      Headers,
      Request,
      Response,
      fetch: nodeFetch,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    Object.assign(global, { fetch: nodeFetch });
  });

  it("loads collection files while keeping row interactions", async () => {
    const fetchMock = mockFetch(() => collectionFilesPage);
    const onFileSelected = jest.fn();
    jest.spyOn(window, "open").mockReturnValue({} as Window);

    renderTable(onFileSelected);

    expect(await screen.findByText("File One")).toBeInTheDocument();
    const statusLabel = screen.getByText("complete");
    expect(statusLabel.closest(".MuiChip-root")).toHaveStyle({
      textTransform: "uppercase",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost/api/file-collections/collection-1/files?pageSize=25"
    );
    expect(screen.getByText("Name")).not.toHaveAttribute("role", "button");
    expect(
      screen.queryByLabelText("Supplied ID Filter (exact)")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "New" })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Select File One")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Delete")).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Name" })).not.toHaveClass(
      "MuiTableCell-paddingNone"
    );
    expect(screen.getByText("File One").closest("th")).not.toHaveClass(
      "MuiTableCell-paddingNone"
    );

    await userEvent.click(screen.getByText("File One"));

    expect(onFileSelected).toHaveBeenCalledWith({
      id: "file-1",
      name: "File One",
      status: "complete",
      suppliedId: "supplied-file-1",
      created: "2026-06-12T15:30:00Z",
      uploaded: "2026-06-12T15:31:00Z",
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Download File One" })
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/files/file-1/download-url", {
        method: "POST",
      });
    });
    expect(window.open).toHaveBeenCalledWith(
      "https://example.test/download/file-1",
      "_blank",
      "noopener"
    );
  });

  it("disables download for files that are not complete", async () => {
    const fetchMock = mockFetch(() => ({
      ...collectionFilesPage,
      data: [
        {
          type: "file",
          id: "file-1",
          attributes: {
            name: "File One",
            status: "pending",
            suppliedId: "supplied-file-1",
            created: "2026-06-12T15:30:00Z",
            uploaded: "2026-06-12T15:31:00Z",
          },
        },
      ],
    }));

    renderTable();

    expect(await screen.findByText("File One")).toBeInTheDocument();
    expect(screen.getByText("pending")).toBeInTheDocument();

    const download = screen.getByRole("button", { name: "Download File One" });
    expect(download).toBeDisabled();

    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/files/file-1/download-url",
      {
        method: "POST",
      }
    );
  });

  it("does not style ready file statuses as success", async () => {
    mockFetch(() => ({
      ...collectionFilesPage,
      data: [
        {
          type: "file",
          id: "file-1",
          attributes: {
            name: "File One",
            status: "ready",
            suppliedId: "supplied-file-1",
            created: "2026-06-12T15:30:00Z",
            uploaded: "2026-06-12T15:31:00Z",
          },
        },
      ],
    }));

    renderTable();

    const statusLabel = await screen.findByText("ready");
    expect(statusLabel.closest(".MuiChip-root")).toHaveClass(
      "MuiChip-colorDefault"
    );
  });

  it("does not treat completed as an available file state", async () => {
    const fetchMock = mockFetch(() => ({
      ...collectionFilesPage,
      data: [
        {
          type: "file",
          id: "file-1",
          attributes: {
            name: "File One",
            status: "completed",
            suppliedId: "supplied-file-1",
            created: "2026-06-12T15:30:00Z",
            uploaded: "2026-06-12T15:31:00Z",
          },
        },
      ],
    }));
    jest.spyOn(window, "open").mockReturnValue({} as Window);

    renderTable();

    expect(await screen.findByText("completed")).toBeInTheDocument();

    const download = screen.getByRole("button", { name: "Download File One" });
    expect(download).toBeDisabled();

    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/files/file-1/download-url",
      {
        method: "POST",
      }
    );
  });

  it("renders an empty files table for an empty collection", async () => {
    mockFetch(() => ({ cursors: { self: "page-1" }, data: [], status: 200 }));

    renderTable();

    expect(await screen.findByText("Files")).toBeInTheDocument();
    expect(screen.queryByText("File One")).not.toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("renders load errors with an error indicator", async () => {
    mockFetch(() => ({
      message: "Could not load collection files.",
      status: 500,
    }));

    renderTable();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Error loading data."
    );
  });
});

function renderTable(onFileSelected = jest.fn()): void {
  render(
    <SWRConfig
      value={{
        dedupingInterval: 0,
        fetcher: (url: string) =>
          (global.fetch as typeof nodeFetch)(
            new URL(url, window.location.origin).toString()
          ).then((res) => res.json()),
        provider: () => new Map(),
      }}
    >
      <FileCollectionFilesTable
        apiPath="/api/file-collections/collection-1/files"
        onFileSelected={onFileSelected}
      />
    </SWRConfig>
  );
}

function mockFetch(responseFor: (url: string) => unknown): jest.Mock {
  const fetchMock = jest.fn((input: RequestInfo | URL) => {
    const url = input.toString();

    if (url.endsWith("/api/files/file-1/download-url")) {
      return Promise.resolve({
        json: () =>
          Promise.resolve({ url: "https://example.test/download/file-1" }),
        ok: true,
      });
    }

    return Promise.resolve({
      json: () => Promise.resolve(responseFor(url)),
      ok: true,
    });
  });

  global.fetch = fetchMock as unknown as typeof nodeFetch;
  return fetchMock;
}
