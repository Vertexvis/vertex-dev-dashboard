import path from "path";
import { spawn } from "child_process";

import { applySession } from "next-iron-session";
import supertest from "supertest";

const CookieName = "sess";
const DefaultCookieSecret = "codex-test-cookie-secret-1234567890";
const ReadyPrefix = "__NEXT_TEST_READY__";

export interface NextApiTestHarness {
  readonly request: ReturnType<typeof supertest>;
  readonly createSessionCookie: (
    sessionData: Record<string, unknown>
  ) => Promise<string>;
  readonly close: () => Promise<void>;
}

// Starts a real Next.js server in a child process so tests go through the actual request handler.
export async function startNextApiHarness(): Promise<NextApiTestHarness> {
  ensureCookieSecret();

  const child = spawn(process.execPath, [serverScriptPath()], {
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

  const baseUrl = await waitForServerReady(child);

  return {
    request: supertest(baseUrl),
    createSessionCookie,
    close: async () => {
      if (child.exitCode != null) return;

      await new Promise<void>((resolve, reject) => {
        child.once("exit", () => resolve());
        child.once("error", reject);
        child.kill("SIGTERM");
      });
    },
  };
}

function ensureCookieSecret(): void {
  if (!process.env.COOKIE_SECRET) {
    process.env.COOKIE_SECRET = DefaultCookieSecret;
  }
}

async function createSessionCookie(
  sessionData: Record<string, unknown>
): Promise<string> {
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
    password: process.env.COOKIE_SECRET!,
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
  return path.join(__dirname, "run-next-server.js");
}

async function waitForServerReady(
  child: ReturnType<typeof spawn>
): Promise<string> {
  const stdout = child.stdout;
  const stderr = child.stderr;
  if (stdout == null || stderr == null) {
    throw new Error("Next test server pipes were not configured correctly.");
  }

  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  return await new Promise<string>((resolve, reject) => {
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
