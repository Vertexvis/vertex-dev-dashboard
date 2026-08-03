import { createResourceClient, requestJson } from "../../lib/api/client";

describe("browser API client", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  it("keeps list keys deterministic and serializes JSON mutations", async () => {
    fetchMock.mockResolvedValue({
      json: () => Promise.resolve({ id: "fixture" }),
    });
    const client = createResourceClient<
      unknown,
      {
        readonly cursor?: string;
        readonly pageSize?: number;
        readonly sort?: string;
      },
      { readonly name: string },
      { readonly name: string }
    >({ path: "/api/fixtures", supports: ["list", "create", "remove"] });

    expect(client.keys.list({ pageSize: 10, sort: "-created" })).toBe(
      "/api/fixtures?pageSize=10&sort=-created"
    );
    await client.create?.({ name: "fixture" });
    await client.remove?.({ ids: ["fixture"] });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/fixtures", {
      body: '{"name":"fixture"}',
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/fixtures", {
      body: '{"ids":["fixture"]}',
      headers: { "Content-Type": "application/json" },
      method: "DELETE",
    });
  });

  it("returns parsed local API error bodies rather than throwing for non-2xx status", async () => {
    fetchMock.mockResolvedValue({
      json: () => Promise.resolve({ message: "Fixture failure.", status: 500 }),
      ok: false,
      status: 500,
    });

    await expect(requestJson("/api/fixtures")).resolves.toEqual({
      message: "Fixture failure.",
      status: 500,
    });
  });
});
