import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { rest } from "msw";
import nodeFetch, { Headers, Request, Response } from "node-fetch";
import React from "react";
import { SWRConfig } from "swr";

import { server } from "../../../../test/msw/server";
import FileTable from "../../../components/file/FileTable";

jest.mock("next/router", () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

const page = {
  cursors: { self: "page-1" },
  data: [
    {
      type: "file",
      id: "file-1",
      attributes: {
        created: "2026-06-10T15:30:00Z",
        name: "alpha.jt",
        status: "complete",
        suppliedId: "supplied-1",
        uploaded: "2026-06-10T15:45:00Z",
      },
    },
  ],
  status: 200,
};

const pagedPage = {
  cursors: { self: "page-1", next: "page-2" },
  data: page.data,
  status: 200,
};

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

describe("FileTable", () => {
  beforeAll(() => {
    Object.assign(global, {
      Headers,
      Request,
      Response,
      fetch: nodeFetch,
    });
    server.listen({ onUnhandledRequest: "error" });
  });

  afterEach(() => {
    server.resetHandlers();
    jest.restoreAllMocks();
    Object.assign(global, { fetch: nodeFetch });
  });

  afterAll(() => {
    server.close();
  });

  it("loads files sorted by created descending by default", async () => {
    const requests: string[] = [];

    server.use(
      rest.get("*/api/files", (req, res, ctx) => {
        requests.push(req.url.toString());
        return res(ctx.json(page));
      })
    );

    renderTable();

    expect(await screen.findByText("alpha.jt")).toBeInTheDocument();
    expect(requests).toContain(
      "http://localhost/api/files?pageSize=25&sort=-created"
    );
  });

  it("sorts by name and toggles direction", async () => {
    const requests: string[] = [];

    server.use(
      rest.get("*/api/files", (req, res, ctx) => {
        requests.push(req.url.toString());
        return res(ctx.json(page));
      })
    );

    renderTable();

    expect(await screen.findByText("alpha.jt")).toBeInTheDocument();

    await userEvent.click(screen.getByText("Name"));
    await waitFor(() => {
      expect(requests).toContain(
        "http://localhost/api/files?pageSize=25&sort=name"
      );
    });

    await userEvent.click(screen.getByText("Name"));
    await waitFor(() => {
      expect(requests).toContain(
        "http://localhost/api/files?pageSize=25&sort=-name"
      );
    });
  });

  it("disables pagination while a sorted request is loading", async () => {
    let resolveSortedPage: ((value: unknown) => void) | undefined;
    const sortedPage = new Promise((resolve) => {
      resolveSortedPage = resolve;
    });
    const fetchMock = jest.fn((input: RequestInfo | URL) => {
      const url = input.toString();

      return Promise.resolve({
        json: () =>
          url.includes("sort=name") ? sortedPage : Promise.resolve(pagedPage),
        ok: true,
      });
    });
    global.fetch = fetchMock as unknown as typeof nodeFetch;

    renderTable();

    expect(await screen.findByText("alpha.jt")).toBeInTheDocument();
    expect(screen.getByLabelText("Go to next page")).toBeEnabled();

    await userEvent.click(screen.getByText("Name"));

    expect(screen.getByLabelText("Go to next page")).toBeDisabled();

    resolveSortedPage?.(page);
    expect(await screen.findByText("alpha.jt")).toBeInTheDocument();
  });

  it("loads collection files from a custom API path while keeping row interactions", async () => {
    const fetchMock = mockFetch(() => collectionFilesPage);
    const onFileSelected = jest.fn();
    jest.spyOn(window, "open").mockReturnValue({} as Window);

    renderTable(onFileSelected, {
      apiPath: "/api/file-collections/collection-1/files",
      showCreateButton: false,
      showDeleteAction: false,
      showSuppliedIdFilter: false,
    });

    expect(await screen.findByText("File One")).toBeInTheDocument();
    const statusLabel = screen.getByText("complete");
    expect(statusLabel.closest(".MuiChip-root")).toHaveStyle({
      textTransform: "uppercase",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost/api/file-collections/collection-1/files?pageSize=25&sort=-created"
    );
    expect(
      screen.queryByLabelText("Supplied ID Filter (exact)")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "New" })
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("Select File One"));

    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(screen.queryByLabelText("Delete")).not.toBeInTheDocument();

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

    renderTable(jest.fn(), {
      apiPath: "/api/file-collections/collection-1/files",
      showCreateButton: false,
      showDeleteAction: false,
      showSuppliedIdFilter: false,
    });

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

  it("styles ready file statuses as success", async () => {
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

    renderTable(jest.fn(), {
      apiPath: "/api/file-collections/collection-1/files",
      showCreateButton: false,
      showDeleteAction: false,
      showSuppliedIdFilter: false,
    });

    const statusLabel = await screen.findByText("ready");
    expect(statusLabel.closest(".MuiChip-root")).toHaveClass(
      "MuiChip-colorSuccess"
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

    renderTable(jest.fn(), {
      apiPath: "/api/file-collections/collection-1/files",
      showCreateButton: false,
      showDeleteAction: false,
      showSuppliedIdFilter: false,
    });

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

    renderTable(jest.fn(), {
      apiPath: "/api/file-collections/collection-1/files",
      showCreateButton: false,
      showDeleteAction: false,
      showSuppliedIdFilter: false,
    });

    expect(await screen.findByText("Files")).toBeInTheDocument();
    expect(screen.queryByText("File One")).not.toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("logs load errors and renders an empty files table when configured", async () => {
    const error = { message: "Could not load collection files.", status: 500 };
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mockFetch(() => error);

    renderTable(jest.fn(), {
      apiPath: "/api/file-collections/collection-1/files",
      emptyOnLoadError: true,
      logLoadError: true,
      showCreateButton: false,
      showDeleteAction: false,
      showSuppliedIdFilter: false,
    });

    expect(await screen.findByText("Files")).toBeInTheDocument();
    expect(screen.queryByText("Error loading data.")).not.toBeInTheDocument();
    expect(screen.queryByText("File One")).not.toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(error);
    });
  });
});

function renderTable(
  onFileSelected = jest.fn(),
  props: Partial<React.ComponentProps<typeof FileTable>> = {}
): void {
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
      <FileTable onFileSelected={onFileSelected} {...props} />
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
