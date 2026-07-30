import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import React from "react";

import { installJsdomMockServer } from "../../../../test/msw/installJsdomMockServer";
import { server } from "../../../../test/msw/server";
import { renderWithSWR } from "../../../../test/render/renderWithSWR";
import FileCollectionFilesTable from "../../../components/file-collection/FileCollectionFilesTable";
import { DefaultPageSize } from "../../../components/shared/Layout";

const collectionFilesApiPath = "/api/file-collections/collection-1/files";
const downloadUrlById = {
  "file-1": "https://example.test/download/file-1",
} as const;
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRouter = {
  isReady: true,
  pathname: "/file-collections/[fileCollectionId]",
  push: mockPush,
  query: { fileCollectionId: "collection-1" } as Record<
    string,
    string | string[] | undefined
  >,
  replace: mockReplace,
};

jest.mock("next/router", () => ({
  useRouter: () => mockRouter,
}));

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

const pagedCollectionFilesPage = {
  ...collectionFilesPage,
  cursors: { self: "page-1", next: "page-2" },
};

describe("FileCollectionFilesTable", () => {
  installJsdomMockServer();

  afterEach(() => {
    jest.restoreAllMocks();
    mockPush.mockClear();
    mockReplace.mockClear();
    mockRouter.query = { fileCollectionId: "collection-1" };
  });

  it("loads collection files while keeping row interactions", async () => {
    const listCollectionFiles = jest.fn(({ request }) => {
      const url = new URL(request.url);

      expect(request.url).toBe(
        `http://localhost${collectionFilesApiPath}?pageSize=${DefaultPageSize}`
      );
      expect(url.searchParams.get("pageSize")).toBe(DefaultPageSize.toString());
      expect(url.searchParams.get("cursor")).toBeNull();

      return HttpResponse.json(
        filePage([
          fileResource({
            id: "file-1",
            name: "File One",
            status: "complete",
            suppliedId: "supplied-file-1",
            created: "2026-06-12T15:30:00Z",
            uploaded: "2026-06-12T15:31:00Z",
          }),
        ])
      );
    });
    const createDownloadUrl = jest.fn(({ params }) => {
      return HttpResponse.json({
        url: downloadUrlById[params.id as keyof typeof downloadUrlById],
      });
    });
    const onFileSelected = jest.fn();
    jest.spyOn(window, "open").mockReturnValue({} as Window);

    mockFileCollectionFilesApi({
      createDownloadUrl,
      listCollectionFiles,
    });

    renderTable(onFileSelected);

    expect(await screen.findByText("File One")).toBeInTheDocument();
    const statusLabel = screen.getByText("complete");
    expect(statusLabel.closest(".MuiChip-root")).toHaveStyle({
      textTransform: "uppercase",
    });
    expect(listCollectionFiles).toHaveBeenCalledTimes(1);
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

    const name = screen.getByLabelText("Download File One");
    await userEvent.hover(name);

    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Download File One"
    );

    expect(name).toHaveAttribute("href", "/api/files/file-1/download");
    expect(onFileSelected).not.toHaveBeenCalled();

    await userEvent.click(screen.getByText("supplied-file-1"));

    expect(onFileSelected).toHaveBeenCalledWith({
      id: "file-1",
      name: "File One",
      status: "complete",
      suppliedId: "supplied-file-1",
      created: "2026-06-12T15:30:00Z",
      uploaded: "2026-06-12T15:31:00Z",
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Actions for File One" })
    );
    await userEvent.click(
      screen.getByRole("menuitem", { name: "Download file" })
    );

    await waitFor(() => {
      expect(createDownloadUrl).toHaveBeenCalledTimes(1);
    });
    expect(window.open).toHaveBeenLastCalledWith(
      downloadUrlById["file-1"],
      "_blank",
      "noopener"
    );
  });

  it("disables download for files that are not complete", async () => {
    const createDownloadUrl = jest.fn();

    mockFileCollectionFilesApi({
      createDownloadUrl,
      files: [
        fileResource({
          id: "file-1",
          name: "File One",
          status: "pending",
          suppliedId: "supplied-file-1",
          created: "2026-06-12T15:30:00Z",
          uploaded: "2026-06-12T15:31:00Z",
        }),
      ],
    });

    renderTable();

    expect(await screen.findByText("File One")).toBeInTheDocument();
    expect(screen.getByText("pending")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Actions for File One" })
    );
    expect(
      screen.getByRole("menuitem", { name: "Download file" })
    ).toHaveAttribute("aria-disabled", "true");
    expect(createDownloadUrl).not.toHaveBeenCalled();
  });

  it("does not style ready file statuses as success", async () => {
    mockFileCollectionFilesApi({
      files: [
        fileResource({
          id: "file-1",
          name: "File One",
          status: "ready",
          suppliedId: "supplied-file-1",
          created: "2026-06-12T15:30:00Z",
          uploaded: "2026-06-12T15:31:00Z",
        }),
      ],
    });

    renderTable();

    const statusLabel = await screen.findByText("ready");
    expect(statusLabel.closest(".MuiChip-root")).toHaveClass(
      "MuiChip-colorDefault"
    );
  });

  it("does not treat completed as an available file state", async () => {
    const createDownloadUrl = jest.fn();
    jest.spyOn(window, "open").mockReturnValue({} as Window);

    mockFileCollectionFilesApi({
      createDownloadUrl,
      files: [
        fileResource({
          id: "file-1",
          name: "File One",
          status: "completed",
          suppliedId: "supplied-file-1",
          created: "2026-06-12T15:30:00Z",
          uploaded: "2026-06-12T15:31:00Z",
        }),
      ],
    });

    renderTable();

    expect(await screen.findByText("completed")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Actions for File One" })
    );
    expect(
      screen.getByRole("menuitem", { name: "Download file" })
    ).toHaveAttribute("aria-disabled", "true");
    expect(createDownloadUrl).not.toHaveBeenCalled();
    expect(window.open).not.toHaveBeenCalled();
  });

  it("renders an empty files table for an empty collection", async () => {
    mockFileCollectionFilesApi({ files: [] });

    renderTable();

    expect(await screen.findByText("Files")).toBeInTheDocument();
    expect(screen.queryByText("File One")).not.toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("renders load errors with an error indicator", async () => {
    mockFileCollectionFilesApi({
      listResponse: HttpResponse.json(
        {
          message: "Could not load collection files.",
          status: 500,
        },
        { status: 500 }
      ),
    });

    renderTable();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Error loading data."
    );
  });

  it("loads cursor paging from the URL", async () => {
    mockRouter.query = {
      fileCollectionId: "collection-1",
      fileCursor: "cursor-2",
      filePage: "2",
      filePreviousCursors: JSON.stringify({ 0: "page-1", 1: "page-2" }),
    };
    const listCollectionFiles = jest.fn(() =>
      HttpResponse.json(collectionFilesPage)
    );
    mockFileCollectionFilesApi({ listCollectionFiles });

    renderTable();

    expect(await screen.findByText("File One")).toBeInTheDocument();
    expect(listCollectionFiles).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.objectContaining({
          url: "http://localhost/api/file-collections/collection-1/files?pageSize=25&cursor=cursor-2",
        }),
      })
    );
  });

  it("stores cursor paging state in the URL when the page changes", async () => {
    const listCollectionFiles = jest.fn(({ request }) =>
      HttpResponse.json(
        request.url.includes("cursor=page-2")
          ? collectionFilesPage
          : pagedCollectionFilesPage
      )
    );
    mockFileCollectionFilesApi({ listCollectionFiles });

    renderTable();

    expect(await screen.findByText("File One")).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("Go to next page"));

    await waitFor(() => {
      expect(listCollectionFiles).toHaveBeenCalledWith(
        expect.objectContaining({
          request: expect.objectContaining({
            url: "http://localhost/api/file-collections/collection-1/files?pageSize=25&cursor=page-2",
          }),
        })
      );
      expect(mockReplace).toHaveBeenCalledWith(
        {
          pathname: "/file-collections/[fileCollectionId]",
          query: {
            fileCollectionId: "collection-1",
            fileCursor: "page-2",
            filePage: "1",
            filePreviousCursors: JSON.stringify({ 0: "page-1" }),
          },
        },
        undefined,
        {
          scroll: false,
          shallow: true,
        }
      );
    });
  });
});

function renderTable(onFileSelected = jest.fn()): void {
  renderWithSWR(
    <FileCollectionFilesTable
      apiPath={collectionFilesApiPath}
      onFileSelected={onFileSelected}
    />
  );
}

interface MockFileCollectionFilesApiOptions {
  readonly createDownloadUrl?: jest.Mock;
  readonly files?: ReturnType<typeof fileResource>[];
  readonly listCollectionFiles?: jest.Mock;
  readonly listResponse?: Response;
}

function mockFileCollectionFilesApi({
  createDownloadUrl = jest.fn(({ params }) =>
    HttpResponse.json({
      url: `https://example.test/download/${params.id as string}`,
    })
  ),
  files = [
    fileResource({
      id: "file-1",
      name: "File One",
      status: "complete",
      suppliedId: "supplied-file-1",
      created: "2026-06-12T15:30:00Z",
      uploaded: "2026-06-12T15:31:00Z",
    }),
  ],
  listCollectionFiles = jest.fn(() => HttpResponse.json(filePage(files))),
  listResponse,
}: MockFileCollectionFilesApiOptions = {}): void {
  server.use(
    http.get("*/api/file-collections/collection-1/files", (info) => {
      if (listResponse != null) return listResponse;

      return listCollectionFiles(info);
    }),
    http.post("*/api/files/:id/download-url", (info) => createDownloadUrl(info))
  );
}

function filePage(data: ReturnType<typeof fileResource>[]): {
  cursors: { self: string };
  data: ReturnType<typeof fileResource>[];
  status: number;
} {
  return {
    cursors: { self: "page-1" },
    data,
    status: 200,
  };
}

function fileResource({
  created = "2026-06-12T15:30:00Z",
  id,
  name,
  status,
  suppliedId,
  uploaded = "2026-06-12T15:31:00Z",
}: {
  readonly created?: string;
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly suppliedId: string;
  readonly uploaded?: string;
}) {
  return {
    type: "file",
    id,
    attributes: {
      created,
      name,
      status,
      suppliedId,
      uploaded,
    },
  } as const;
}
