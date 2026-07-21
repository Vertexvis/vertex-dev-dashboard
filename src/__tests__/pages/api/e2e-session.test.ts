/**
 * @jest-environment node
 */
import type { NextApiResponse } from "next";

import { NextIronRequest } from "../../../lib/with-session";
import { handleE2eSession } from "../../../pages/api/test/e2e-session";

function response(): NextApiResponse & {
  readonly body: () => unknown;
  readonly statusCode: () => number | undefined;
} {
  let body: unknown;
  let statusCode: number | undefined;
  const res = {
    body: () => body,
    json: jest.fn((value: unknown) => {
      body = value;
      return res;
    }),
    status: jest.fn((status: number) => {
      statusCode = status;
      return res;
    }),
    statusCode: () => statusCode,
  };
  return res as unknown as NextApiResponse & {
    readonly body: () => unknown;
    readonly statusCode: () => number | undefined;
  };
}

function request(method: string, secret?: string): NextIronRequest {
  return {
    headers: secret == null ? {} : { "x-e2e-session-secret": secret },
    method,
    session: { save: jest.fn(), set: jest.fn() },
  } as unknown as NextIronRequest;
}

describe("local e2e session bootstrap", () => {
  const originalMode = process.env.E2E_TEST_MODE;
  const originalSecret = process.env.E2E_SESSION_SECRET;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    restoreEnv("E2E_TEST_MODE", originalMode);
    restoreEnv("E2E_SESSION_SECRET", originalSecret);
    restoreEnv("NODE_ENV", originalNodeEnv);
  });

  it("fails closed for the wrong method, disabled mode, and missing or wrong secrets", async () => {
    process.env.NODE_ENV = "test";
    process.env.E2E_SESSION_SECRET = "ephemeral-secret";
    const methodRes = response();
    await handleE2eSession(request("GET", "ephemeral-secret"), methodRes);
    expect(methodRes.statusCode()).toBe(405);

    process.env.E2E_TEST_MODE = "false";
    const disabledRes = response();
    await handleE2eSession(request("POST", "ephemeral-secret"), disabledRes);
    expect(disabledRes.statusCode()).toBe(404);

    process.env.E2E_TEST_MODE = "true";
    const missingRes = response();
    await handleE2eSession(request("POST"), missingRes);
    expect(missingRes.statusCode()).toBe(404);
    const wrongRes = response();
    await handleE2eSession(request("POST", "wrong-secret"), wrongRes);
    expect(wrongRes.statusCode()).toBe(404);

    process.env.NODE_ENV = "production";
    const productionRes = response();
    await handleE2eSession(request("POST", "ephemeral-secret"), productionRes);
    expect(productionRes.statusCode()).toBe(404);
  });

  it("creates a session only for explicit local test mode and the matching secret", async () => {
    process.env.NODE_ENV = "test";
    process.env.E2E_TEST_MODE = "true";
    process.env.E2E_SESSION_SECRET = "ephemeral-secret";
    const req = request("POST", "ephemeral-secret");
    const res = response();

    await handleE2eSession(req, res);

    expect(res.statusCode()).toBe(200);
    expect(req.session.set).toHaveBeenCalledTimes(4);
    expect(req.session.save).toHaveBeenCalledTimes(1);
  });
});

function restoreEnv(key: string, value: string | undefined): void {
  if (value == null) delete process.env[key];
  else process.env[key] = value;
}
