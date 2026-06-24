/**
 * @jest-environment node
 */
import { spawn } from "child_process";
import { applySession } from "next-iron-session";
import path from "path";
import request from "supertest";

import {
  type HttpMockServerHarness,
  startHttpMockServer,
} from "../../../../test/helpers/http-mockserver";
import {
  CredsKey,
  EnvKey,
  NetworkConfig as NetworkConfigKey,
  TokenKey,
} from "../../../lib/with-session";

jest.setTimeout(120_000);
process.env.COOKIE_SECRET = "codex-test-cookie-secret-1234567890";

type JsonBody = Record<string, unknown>;
type ServerProcess = ReturnType<typeof spawn>;
type RequestClient = ReturnType<typeof request>;

const CookieName = "sess";
const ReadyPrefix = "__NEXT_TEST_READY__";

describe("file collection API routes", () => {
  let mockServer: HttpMockServerHarness;
  let nextServer: ServerProcess;
  let requestClient: RequestClient;
  let sessionCookie: string;

  beforeAll(async () => {
    mockServer = await startHttpMockServer();
    nextServer = startNextServer();
    requestClient = request(await waitForServerReady(nextServer));
    sessionCookie = await createSessionCookie(
      createSessionData(mockServer.apiHost)
    );
  });

  afterAll(async () => {
    await stopNextServer(nextServer);
    await mockServer.stop();
  });

  beforeEach(async () => {
    await mockServer.reset();
  });

  it("lists file collections with query parameters", async () => {
    await expectFileCollectionList(mockServer, {
      "filter[suppliedId]": ["supplied-1"],
      "page[cursor]": ["cursor-1"],
      "page[size]": ["50"],
    });

    const res = await requestClient
      .get(
        "/api/file-collections?cursor=cursor-1&pageSize=50&suppliedId=supplied-1"
      )
      .set("Cookie", sessionCookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      cursors: { next: "next-page", self: "self-page" },
      data: [collectionData("collection-1")],
      status: 200,
    });
    await verifyListFileCollections(mockServer, {
      "filter[suppliedId]": ["supplied-1"],
      "page[cursor]": ["cursor-1"],
      "page[size]": ["50"],
    });
  });

  it("uses the default page size when one is not supplied", async () => {
    await expectFileCollectionList(mockServer, { "page[size]": ["10"] });

    const res = await requestClient
      .get("/api/file-collections")
      .set("Cookie", sessionCookie);

    expect(res.status).toBe(200);
    await verifyListFileCollections(mockServer, { "page[size]": ["10"] });
  });

  it("validates delete request bodies before calling Vertex", async () => {
    const missingBody = await requestClient
      .delete("/api/file-collections")
      .set("Cookie", sessionCookie);
    const invalidBody = await requestClient
      .delete("/api/file-collections")
      .set("Cookie", sessionCookie)
      .set("Content-Type", "text/plain")
      .send("{}");

    expect(missingBody.status).toBe(400);
    expect(missingBody.body).toEqual({
      message: "Body required.",
      status: 400,
    });
    expect(invalidBody.status).toBe(400);
    expect(invalidBody.body).toEqual({
      message: "Invalid body.",
      status: 400,
    });
    await mockServer.verifyZeroInteractions();
  });

  it("deletes each supplied file collection ID", async () => {
    await expectDeleteFileCollection(mockServer, "collection-1");
    await expectDeleteFileCollection(mockServer, "collection-2");

    const res = await requestClient
      .delete("/api/file-collections")
      .set("Cookie", sessionCookie)
      .set("Content-Type", "text/plain")
      .send(JSON.stringify({ ids: ["collection-1", "collection-2"] }));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 200 });
    await verifyDeleteFileCollection(mockServer, "collection-1");
    await verifyDeleteFileCollection(mockServer, "collection-2");
  });

  it("returns Vertex API failures from delete requests", async () => {
    await expectDeleteFileCollection(mockServer, "collection-1", {
      body: failureBody("404", "Collection not found."),
      statusCode: 404,
    });

    const res = await requestClient
      .delete("/api/file-collections")
      .set("Cookie", sessionCookie)
      .set("Content-Type", "text/plain")
      .send(JSON.stringify({ ids: ["collection-1"] }));

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      message: "Collection not found.",
      status: 404,
    });
    await verifyDeleteFileCollection(mockServer, "collection-1");
  });

  it("gets a file collection by ID", async () => {
    await mockServer.mockAnyResponse({
      httpRequest: { method: "GET", path: "/file-collections/collection-1" },
      httpResponse: jsonResponse({
        data: collectionData("collection-1"),
        links: {},
      }),
    });

    const res = await requestClient
      .get("/api/file-collections/collection-1")
      .set("Cookie", sessionCookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: collectionData("collection-1"),
      status: 200,
    });
    await mockServer.verify(
      { method: "GET", path: "/file-collections/collection-1" },
      1,
      1
    );
  });

  it("returns Vertex API failures from get requests", async () => {
    await mockServer.mockAnyResponse({
      httpRequest: { method: "GET", path: "/file-collections/collection-1" },
      httpResponse: jsonResponse(failureBody("500", "Vertex is upset."), 500),
    });

    const res = await requestClient
      .get("/api/file-collections/collection-1")
      .set("Cookie", sessionCookie);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      message: "Vertex is upset.",
      status: 500,
    });
  });

  it("rejects unsupported collection methods", async () => {
    const collectionRes = await requestClient
      .post("/api/file-collections")
      .set("Cookie", sessionCookie);
    const collectionByIdRes = await requestClient
      .delete("/api/file-collections/collection-1")
      .set("Cookie", sessionCookie);

    expect(collectionRes.status).toBe(405);
    expect(collectionRes.body).toEqual({
      message: "Method not allowed.",
      status: 405,
    });
    expect(collectionByIdRes.status).toBe(405);
    expect(collectionByIdRes.body).toEqual({
      message: "Method not allowed.",
      status: 405,
    });
    await mockServer.verifyZeroInteractions();
  });
});

function startNextServer(): ServerProcess {
  return spawn(process.execPath, [serverScriptPath()], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      COOKIE_SECRET: process.env.COOKIE_SECRET,
      NEXT_TEST_DIR: process.cwd(),
      NEXT_TEST_HOST: "127.0.0.1",
      NEXT_TEST_PORT: "0",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function stopNextServer(child: ServerProcess): Promise<void> {
  if (child.exitCode != null) return;

  await new Promise<void>((resolve, reject) => {
    child.once("exit", () => resolve());
    child.once("error", reject);
    child.kill("SIGTERM");
  });
}

function waitForServerReady(child: ServerProcess): Promise<string> {
  const stdout = child.stdout;
  const stderr = child.stderr;
  if (stdout == null || stderr == null) {
    throw new Error("Next test server pipes were not configured correctly.");
  }

  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  return new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(
        new Error(
          `Timed out waiting for Next test server.\nstdout:\n${stdoutLines.join(
            "\n"
          )}\nstderr:\n${stderrLines.join("\n")}`
        )
      );
    }, 30_000);

    const onStdout = (chunk: Buffer) => {
      const text = chunk.toString();
      stdoutLines.push(text);

      for (const line of text.split("\n")) {
        if (!line.startsWith(ReadyPrefix)) continue;

        clearTimeout(timeout);
        stdout.off("data", onStdout);
        stderr.off("data", onStderr);
        child.off("exit", onExit);

        const { host, port } = JSON.parse(line.slice(ReadyPrefix.length)) as {
          readonly host: string;
          readonly port: number;
        };
        resolve(`http://${host}:${port}`);
      }
    };

    const onStderr = (chunk: Buffer) => {
      stderrLines.push(chunk.toString());
    };

    const onExit = (code: number | null) => {
      clearTimeout(timeout);
      reject(
        new Error(
          `Next test server exited before becoming ready (code ${code}).\nstdout:\n${stdoutLines.join(
            "\n"
          )}\nstderr:\n${stderrLines.join("\n")}`
        )
      );
    };

    stdout.on("data", onStdout);
    stderr.on("data", onStderr);
    child.once("exit", onExit);
    child.once("error", reject);
  });
}

async function createSessionCookie(
  sessionData: Record<string, unknown>
): Promise<string> {
  const cookieSecret = process.env.COOKIE_SECRET;
  if (cookieSecret == null) {
    throw new Error("COOKIE_SECRET must be set for API route tests.");
  }

  const req = { headers: {} } as {
    headers: Record<string, string>;
    session?: {
      set: (key: string, value: unknown) => void;
      save: () => Promise<string>;
    };
  };
  const headers = new Map<string, string | string[]>();
  const res = {
    getHeader: (name: string) => headers.get(name.toLowerCase()),
    setHeader: (name: string, value: string | string[]) => {
      headers.set(name.toLowerCase(), value);
    },
  } as {
    getHeader: (name: string) => string | string[] | undefined;
    setHeader: (name: string, value: string | string[]) => void;
  };

  await applySession(req, res, {
    cookieName: CookieName,
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
    },
    password: cookieSecret,
  });

  Object.entries(sessionData).forEach(([key, value]) => {
    req.session?.set(key, value);
  });

  await req.session?.save();

  const setCookie = headers.get("set-cookie");
  const cookieHeader = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  if (cookieHeader == null) {
    throw new Error("Session cookie was not written.");
  }

  return cookieHeader.split(";")[0];
}

function serverScriptPath(): string {
  return path.join(__dirname, "../../../../test/helpers/run-next-server.js");
}

async function expectFileCollectionList(
  mockServer: HttpMockServerHarness,
  queryStringParameters: Record<string, string[]>
): Promise<void> {
  await mockServer.mockAnyResponse({
    httpRequest: {
      method: "GET",
      path: "/file-collections",
      queryStringParameters,
    },
    httpResponse: jsonResponse({
      data: [collectionData("collection-1")],
      links: {
        next: {
          href: `${mockServer.apiHost}/file-collections?page[cursor]=next-page`,
        },
        self: {
          href: `${mockServer.apiHost}/file-collections?page[cursor]=self-page`,
        },
      },
    }),
  });
}

async function verifyListFileCollections(
  mockServer: HttpMockServerHarness,
  queryStringParameters: Record<string, string[]>
): Promise<void> {
  await mockServer.verify(
    { method: "GET", path: "/file-collections", queryStringParameters },
    1,
    1
  );
}

async function expectDeleteFileCollection(
  mockServer: HttpMockServerHarness,
  id: string,
  response: { readonly body: JsonBody; readonly statusCode: number } = {
    body: {},
    statusCode: 204,
  }
): Promise<void> {
  await mockServer.mockAnyResponse({
    httpRequest: { method: "DELETE", path: `/file-collections/${id}` },
    httpResponse: jsonResponse(response.body, response.statusCode),
  });
}

async function verifyDeleteFileCollection(
  mockServer: HttpMockServerHarness,
  id: string
): Promise<void> {
  await mockServer.verify(
    { method: "DELETE", path: `/file-collections/${id}` },
    1,
    1
  );
}

function collectionData(id: string): JsonBody {
  return {
    attributes: {
      created: "2026-06-10T15:30:00Z",
      name: "Collection One",
      suppliedId: "supplied-1",
    },
    id,
    type: "file-collection",
  };
}

function createSessionData(apiHost: string): Record<string, unknown> {
  return {
    [CredsKey]: { id: "client-id", secret: "client-secret" },
    [EnvKey]: "custom",
    [NetworkConfigKey]: {
      apiHost,
      name: "mock-server",
      renderingHost: apiHost,
      sceneTreeHost: apiHost,
      sceneViewHost: apiHost,
    },
    [TokenKey]: {
      expiration: Date.now() + 60 * 60 * 1000,
      token: {
        access_token: "test-token",
        account_id: "account-id",
        expires_in: 60 * 60,
        scopes: [],
        token_type: "Bearer",
      },
    },
  };
}

function failureBody(status: string, title: string): JsonBody {
  return { errors: [{ status, title }] };
}

function jsonResponse(body: JsonBody, statusCode = 200): JsonBody {
  return {
    body: JSON.stringify(body),
    headers: { "content-type": ["application/json"] },
    statusCode,
  };
}
