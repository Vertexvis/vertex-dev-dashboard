import { render, screen } from "@testing-library/react";
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
  ({ apiPath, mode }: { readonly apiPath: string; readonly mode: string }) => (
    <div data-api-path={apiPath} data-mode={mode} data-testid="files-table">
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
    mockGetClientFromSession.mockResolvedValue({ client: "test-client" });
    mockGetFileCollectionsApi.mockReturnValue({
      getFileCollection: mockGetFileCollection,
    });
    mockGetFileCollection.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders return navigation and file collection metadata", () => {
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
    expect(filesTable).toHaveAttribute("data-mode", "filesCollection");
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
