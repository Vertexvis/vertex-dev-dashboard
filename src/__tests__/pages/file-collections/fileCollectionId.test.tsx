import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { Session } from "next-iron-session";
import React from "react";

import {
  CredsKey,
  EnvKey,
  NetworkConfig,
  NextIronRequest,
  TokenKey,
} from "../../../lib/with-session";
import FileCollectionDetails, {
  serverSidePropsHandler,
} from "../../../pages/file-collections/[fileCollectionId]";

const mockGetClientFromSession = jest.fn();
const mockGetFileCollectionsApi = jest.fn();
const mockGetFileCollection = jest.fn();
const mockFileTable = jest.fn(
  ({
    apiPath,
    emptyOnLoadError,
    logLoadError,
    showCreateButton,
    showDeleteAction,
    showSuppliedIdFilter,
  }: {
    readonly apiPath: string;
    readonly emptyOnLoadError: boolean;
    readonly logLoadError: boolean;
    readonly showCreateButton: boolean;
    readonly showDeleteAction: boolean;
    readonly showSuppliedIdFilter: boolean;
  }) => (
    <div
      data-api-path={apiPath}
      data-empty-on-load-error={emptyOnLoadError.toString()}
      data-log-load-error={logLoadError.toString()}
      data-show-create-button={showCreateButton.toString()}
      data-show-delete-action={showDeleteAction.toString()}
      data-show-supplied-id-filter={showSuppliedIdFilter.toString()}
      data-testid="files-table"
    >
      Files Table
    </div>
  )
);

jest.mock("../../../components/shared/Layout", () => ({
  Layout: ({ main }: { readonly main: unknown }) => main,
}));

jest.mock(
  "next/dynamic",
  () => () => (props: Record<string, unknown>) => mockFileTable(props)
);

jest.mock("../../../lib/vertex-api", () => {
  const actual = jest.requireActual("../../../lib/vertex-api");
  return {
    ...actual,
    getClientFromSession: (...args: unknown[]) =>
      mockGetClientFromSession(...args),
  };
});

jest.mock("../../../lib/file-collections", () => {
  const actual = jest.requireActual("../../../lib/file-collections");
  return {
    ...actual,
    getFileCollectionsApi: (...args: unknown[]) =>
      mockGetFileCollectionsApi(...args),
  };
});

describe("FileCollectionDetails", () => {
  beforeEach(() => {
    jest.useRealTimers();
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        fileCount: 2,
        ready: true,
        status: 200,
      })
    );
    mockGetClientFromSession.mockResolvedValue({ client: "test-client" });
    mockGetFileCollectionsApi.mockReturnValue({
      getFileCollection: mockGetFileCollection,
    });
    mockGetFileCollection.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("renders return navigation and file collection metadata", async () => {
    render(
      <FileCollectionDetails
        fileCollection={{
          id: "collection-1",
          name: "Collection One",
          suppliedId: "supplied-1",
          created: "2026-06-10T15:30:00Z",
          expiresAt: "2026-07-10T15:30:00Z",
          metadata: { source: "unit-test" },
        }}
      />
    );

    expect(
      screen.getByRole("link", { name: "File Collections" })
    ).toHaveAttribute("href", "/file-collections");
    expect(screen.getByText("File Collection Details")).toBeInTheDocument();
    expect(screen.getAllByText("Collection One").length).toBeGreaterThan(0);
    expect(screen.getAllByText("collection-1").length).toBeGreaterThan(0);
    expect(screen.getByText("supplied-1")).toBeInTheDocument();
    expect(screen.getByText("source")).toBeInTheDocument();
    expect(screen.getByText("unit-test")).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Export Archive" })
      ).toBeEnabled()
    );
  });

  it("renders the collection files table below metadata", async () => {
    render(
      <FileCollectionDetails
        fileCollection={{
          id: "collection-1",
          name: "Collection One",
          suppliedId: "supplied-1",
          created: "2026-06-10T15:30:00Z",
          expiresAt: "2026-07-10T15:30:00Z",
          metadata: { source: "unit-test" },
        }}
      />
    );

    const filesTable = await screen.findByTestId("files-table");

    expect(filesTable).toHaveAttribute(
      "data-api-path",
      "/api/file-collections/collection-1/files"
    );
    expect(filesTable).toHaveAttribute("data-empty-on-load-error", "true");
    expect(filesTable).toHaveAttribute("data-log-load-error", "true");
    expect(filesTable).toHaveAttribute("data-show-create-button", "false");
    expect(filesTable).toHaveAttribute("data-show-delete-action", "false");
    expect(filesTable).toHaveAttribute("data-show-supplied-id-filter", "false");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Export Archive" })
      ).toBeEnabled()
    );
  });

  it("disables export and shows the server readiness reason", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse({
        fileCount: 0,
        message: "File collection has no files to export.",
        ready: false,
        status: 200,
      })
    );

    render(<FileCollectionDetails fileCollection={fileCollection()} />);

    const button = await screen.findByRole("button", {
      name: "Export Archive",
    });

    expect(
      await screen.findByText("File collection has no files to export.")
    ).toBeInTheDocument();
    expect(button).toBeDisabled();
  });

  it("keeps polling running archive jobs and shows the download action after completion", async () => {
    jest.useFakeTimers();
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(
        jsonResponse({
          fileCount: 2,
          ready: true,
          status: 200,
        })
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            archiveFileId: "archive-file-1",
            data: {
              attributes: { status: "running" },
              id: "job-1",
            },
            status: 201,
          },
          201
        )
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            attributes: { status: "running" },
            id: "job-1",
          },
          status: 200,
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            attributes: { status: "complete" },
            id: "job-1",
          },
          status: 200,
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          status: 200,
          url: "https://example.test/archive.zip",
        })
      );

    render(<FileCollectionDetails fileCollection={fileCollection()} />);

    const exportButton = await screen.findByRole("button", {
      name: "Export Archive",
    });
    await waitFor(() => expect(exportButton).toBeEnabled());

    fireEvent.click(exportButton);

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith("/api/file-jobs", {
        body: JSON.stringify({ fileCollectionId: "collection-1" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      })
    );
    expect(
      screen.getByRole("button", { name: "Exporting Archive" })
    ).toBeDisabled();
    await screen.findByText("Archive job is running.");

    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith("/api/file-jobs/job-1")
    );
    expect(
      screen.getByRole("button", { name: "Exporting Archive" })
    ).toBeDisabled();

    await act(async () => {
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith("/api/file-jobs/job-1")
    );
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/files/archive-file-1/download-url",
        { method: "POST" }
      )
    );

    const download = await screen.findByRole("link", {
      name: "Download Archive",
    });
    expect(download).toHaveAttribute(
      "href",
      "https://example.test/archive.zip"
    );
    expect(
      screen.getByText("Archive is ready to download.")
    ).toBeInTheDocument();
  });

  it("shows a retryable failure when the download URL cannot be created", async () => {
    jest.useFakeTimers();
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(
        jsonResponse({
          fileCount: 2,
          ready: true,
          status: 200,
        })
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            archiveFileId: "archive-file-1",
            data: {
              attributes: { status: "running" },
              id: "job-1",
            },
            status: 201,
          },
          201
        )
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            attributes: { status: "complete" },
            id: "job-1",
          },
          status: 200,
        })
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            message: "Could not create download URL.",
            status: 500,
          },
          500
        )
      );

    render(<FileCollectionDetails fileCollection={fileCollection()} />);

    const exportButton = await screen.findByRole("button", {
      name: "Export Archive",
    });
    await waitFor(() => expect(exportButton).toBeEnabled());

    fireEvent.click(exportButton);

    await screen.findByText("Archive job is running.");

    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/files/archive-file-1/download-url",
        { method: "POST" }
      )
    );
    expect(
      await screen.findByText("Could not create download URL.")
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(
      screen.getByRole("button", { name: "Export Archive" })
    ).toBeEnabled();
  });

  it("shows failed archive jobs and allows retry from the page", async () => {
    jest.useFakeTimers();
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(
        jsonResponse({
          fileCount: 2,
          ready: true,
          status: 200,
        })
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            archiveFileId: "archive-file-1",
            data: {
              attributes: { status: "running" },
              id: "job-1",
            },
            status: 201,
          },
          201
        )
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            attributes: { status: "error" },
            id: "job-1",
          },
          status: 200,
        })
      );

    render(<FileCollectionDetails fileCollection={fileCollection()} />);

    const exportButton = await screen.findByRole("button", {
      name: "Export Archive",
    });
    await waitFor(() => expect(exportButton).toBeEnabled());

    fireEvent.click(exportButton);

    await screen.findByText("Archive job is running.");

    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    expect(await screen.findByText("Archive job failed.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(
      screen.getByRole("button", { name: "Export Archive" })
    ).toBeEnabled();
  });

  it("loads a file collection by URL ID on the server", async () => {
    mockGetFileCollection.mockResolvedValue({
      data: {
        data: {
          type: "file-collection",
          id: "collection-1",
          attributes: {
            name: "Collection One",
            suppliedId: "supplied-1",
            created: "2026-06-10T15:30:00Z",
            expiresAt: "2026-07-10T15:30:00Z",
            metadata: { source: "unit-test" },
          },
        },
      },
    });

    const res = await serverSidePropsHandler({
      query: { fileCollectionId: "collection-1" },
      req: createReq(createSession()),
    });

    expect(mockGetFileCollection).toHaveBeenCalledWith({
      id: "collection-1",
    });
    expect(res).toEqual({
      props: {
        clientId: "client-id",
        vertexEnv: "custom",
        networkConfig: {
          apiHost: "https://example.test",
          name: "test",
          renderingHost: "https://example.test",
          sceneTreeHost: "https://example.test",
          sceneViewHost: "https://example.test",
        },
        fileCollection: {
          id: "collection-1",
          name: "Collection One",
          suppliedId: "supplied-1",
          created: "2026-06-10T15:30:00Z",
          expiresAt: "2026-07-10T15:30:00Z",
          metadata: { source: "unit-test" },
        },
      },
    });
  });

  it("redirects unauthenticated direct URL requests to login", async () => {
    const res = await serverSidePropsHandler({
      query: { fileCollectionId: "collection-1" },
      req: createReq(createSession({ authenticated: false })),
    });

    expect(res).toEqual({
      redirect: { statusCode: 302, destination: "/login" },
    });
    expect(mockGetFileCollection).not.toHaveBeenCalled();
  });

  it("returns notFound when the route has no file collection ID", async () => {
    const res = await serverSidePropsHandler({
      query: {},
      req: createReq(createSession()),
    });

    expect(res).toEqual({ notFound: true });
    expect(mockGetFileCollection).not.toHaveBeenCalled();
  });

  it("returns notFound for Vertex 404 responses", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    mockGetFileCollection.mockRejectedValue({
      response: {
        data: { errors: [{ status: "404", title: "Collection not found." }] },
      },
    });

    const res = await serverSidePropsHandler({
      query: { fileCollectionId: "missing-collection" },
      req: createReq(createSession()),
    });

    expect(res).toEqual({ notFound: true });
  });
});

function createReq(session: Session): NextIronRequest {
  return { session } as NextIronRequest;
}

function createSession({
  authenticated = true,
}: { readonly authenticated?: boolean } = {}): Session {
  const values = new Map<string, unknown>([
    [EnvKey, "custom"],
    [
      NetworkConfig,
      {
        apiHost: "https://example.test",
        name: "test",
        renderingHost: "https://example.test",
        sceneTreeHost: "https://example.test",
        sceneViewHost: "https://example.test",
      },
    ],
  ]);

  if (authenticated) {
    values.set(CredsKey, { id: "client-id", secret: "client-secret" });
    values.set(TokenKey, {
      expiration: Date.now() + 60 * 60 * 1000,
      token: {
        access_token: "test-token",
        account_id: "account-id",
        expires_in: 60 * 60,
        scopes: [],
        token_type: "Bearer",
      },
    });
  }

  return {
    get: (key: string) => values.get(key),
    set: (key: string, value: unknown) => {
      values.set(key, value);
    },
  } as unknown as Session;
}

function fileCollection() {
  return {
    id: "collection-1",
    name: "Collection One",
    suppliedId: "supplied-1",
    created: "2026-06-10T15:30:00Z",
    expiresAt: "2026-07-10T15:30:00Z",
    metadata: { source: "unit-test" },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    json: () => Promise.resolve(body),
    ok: status >= 200 && status < 300,
    status,
  } as Response;
}
