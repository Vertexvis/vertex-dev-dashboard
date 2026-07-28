import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { Session } from "next-iron-session";
import React from "react";

import {
  propertyKeyPolicyEntriesRes,
  propertyKeyPolicyEntry,
} from "../../../../test/msw/handlers/property-key-policies";
import { installJsdomMockServer } from "../../../../test/msw/installJsdomMockServer";
import { server } from "../../../../test/msw/server";
import { renderWithSWR } from "../../../../test/render/renderWithSWR";
import {
  CredsKey,
  EnvKey,
  NetworkConfig,
  NextIronRequest,
  TokenKey,
} from "../../../lib/with-session";
import PropertyKeyPolicyDetails, {
  serverSidePropsHandler,
} from "../../../pages/property-key-policies/[propertyKeyPolicyId]";

const mockGetClientFromSession = jest.fn();
const mockGetPropertyKeyPoliciesApi = jest.fn();
const mockGetPropertyKeyPolicy = jest.fn();

jest.mock("../../../components/shared/Layout", () => ({
  Layout: ({ main }: { readonly main: unknown }) => main,
}));

jest.mock("../../../lib/vertex-api", () => {
  const actual = jest.requireActual("../../../lib/vertex-api");
  return {
    ...actual,
    getClientFromSession: (...args: unknown[]) =>
      mockGetClientFromSession(...args),
  };
});

jest.mock("../../../lib/property-key-policies", () => {
  const actual = jest.requireActual("../../../lib/property-key-policies");
  return {
    ...actual,
    getPropertyKeyPoliciesApi: (...args: unknown[]) =>
      mockGetPropertyKeyPoliciesApi(...args),
  };
});

describe("PropertyKeyPolicyDetails", () => {
  installJsdomMockServer();

  beforeEach(() => {
    server.use(
      http.get("*/api/property-key-policies/:id/entries", () =>
        HttpResponse.json(propertyKeyPolicyEntriesRes({ data: [] }))
      )
    );
    mockGetClientFromSession.mockResolvedValue({ client: "test-client" });
    mockGetPropertyKeyPoliciesApi.mockReturnValue({
      getPropertyKeyPolicy: mockGetPropertyKeyPolicy,
    });
    mockGetPropertyKeyPolicy.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders breadcrumb navigation and policy metadata", () => {
    renderWithSWR(
      <PropertyKeyPolicyDetails
        propertyKeyPolicy={{
          id: "policy-1",
          name: "My Policy",
          suppliedId: "supplied-1",
          createdAt: "2026-06-10T15:30:00Z",
          mode: "allowlist",
        }}
      />
    );

    expect(
      screen.getByRole("link", { name: "Property Key Policies" })
    ).toHaveAttribute("href", "/property-key-policies");
    expect(screen.getByText("Property Key Policy")).toBeInTheDocument();
    expect(screen.getAllByText("My Policy").length).toBeGreaterThan(0);
    expect(screen.getAllByText("policy-1").length).toBeGreaterThan(0);
  });

  it("renders the entries list with loaded entries", async () => {
    server.use(
      http.get("*/api/property-key-policies/:id/entries", () =>
        HttpResponse.json(
          propertyKeyPolicyEntriesRes({
            data: [
              propertyKeyPolicyEntry({ id: "entry-1", name: "entry-key-1" }),
            ],
          })
        )
      )
    );

    renderWithSWR(
      <PropertyKeyPolicyDetails
        propertyKeyPolicy={{
          id: "policy-1",
          name: "My Policy",
          suppliedId: "supplied-1",
          createdAt: "2026-06-10T15:30:00Z",
          mode: "allowlist",
        }}
      />
    );

    expect(await screen.findByText("entry-key-1")).toBeInTheDocument();
  });

  it("shows an error state when the entries fetch fails", async () => {
    server.use(
      http.get("*/api/property-key-policies/:id/entries", () =>
        HttpResponse.json(
          { message: "Could not load entries.", status: 500 },
          { status: 500 }
        )
      )
    );

    renderWithSWR(
      <PropertyKeyPolicyDetails
        propertyKeyPolicy={{
          id: "policy-1",
          name: "My Policy",
          suppliedId: "supplied-1",
          createdAt: "2026-06-10T15:30:00Z",
          mode: "allowlist",
        }}
      />
    );

    expect(
      await screen.findByText("Could not load property keys.")
    ).toBeInTheDocument();
  });

  it("loads a policy by URL ID on the server", async () => {
    mockGetPropertyKeyPolicy.mockResolvedValue({
      data: {
        data: {
          type: "property-key-policy",
          id: "policy-1",
          attributes: {
            name: "My Policy",
            suppliedId: "supplied-1",
            createdAt: "2026-06-10T15:30:00Z",
            mode: "allowlist",
          },
        },
      },
    });

    const res = await serverSidePropsHandler({
      query: { propertyKeyPolicyId: "policy-1" },
      req: createReq(createSession()),
    });

    expect(mockGetPropertyKeyPolicy).toHaveBeenCalledWith({ id: "policy-1" });
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
        propertyKeyPolicy: {
          id: "policy-1",
          name: "My Policy",
          suppliedId: "supplied-1",
          createdAt: "2026-06-10T15:30:00Z",
          mode: "allowlist",
        },
      },
    });
  });

  it("redirects unauthenticated direct URL requests to login", async () => {
    const res = await serverSidePropsHandler({
      query: { propertyKeyPolicyId: "policy-1" },
      req: createReq(createSession({ authenticated: false })),
    });

    expect(res).toEqual({
      redirect: { statusCode: 302, destination: "/login" },
    });
    expect(mockGetPropertyKeyPolicy).not.toHaveBeenCalled();
  });

  it("returns notFound when the route has no policy ID", async () => {
    const res = await serverSidePropsHandler({
      query: {},
      req: createReq(createSession()),
    });

    expect(res).toEqual({ notFound: true });
    expect(mockGetPropertyKeyPolicy).not.toHaveBeenCalled();
  });

  it("returns notFound for Vertex 404 responses", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    mockGetPropertyKeyPolicy.mockRejectedValue({
      response: {
        data: { errors: [{ status: "404", title: "Policy not found." }] },
      },
    });

    const res = await serverSidePropsHandler({
      query: { propertyKeyPolicyId: "missing-policy" },
      req: createReq(createSession()),
    });

    expect(res).toEqual({ notFound: true });
  });

  it("returns notFound for Vertex 400 responses", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    mockGetPropertyKeyPolicy.mockRejectedValue({
      response: {
        data: { errors: [{ status: "400", title: "Bad request." }] },
      },
    });

    const res = await serverSidePropsHandler({
      query: { propertyKeyPolicyId: "bad-policy" },
      req: createReq(createSession()),
    });

    expect(res).toEqual({ notFound: true });
  });

  it("throws for non-404/400 Vertex error responses", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    mockGetPropertyKeyPolicy.mockRejectedValue({
      response: {
        data: { errors: [{ status: "500", title: "Internal server error." }] },
      },
    });

    await expect(
      serverSidePropsHandler({
        query: { propertyKeyPolicyId: "policy-1" },
        req: createReq(createSession()),
      })
    ).rejects.toThrow("Internal server error.");
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
