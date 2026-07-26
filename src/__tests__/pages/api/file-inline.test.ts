/**
 * @jest-environment node
 */
import type { NextApiResponse } from "next";

import {
  ImagePreviewMaxBytes,
  PdfPreviewMaxBytes,
  TextPreviewMaxBytes,
} from "../../../lib/file-preview";
import { NextIronRequest } from "../../../lib/with-session";
import { handleFileInline } from "../../../pages/api/files/[id]/inline";

const mockCreateDownloadUrl = jest.fn();

jest.mock("../../../lib/vertex-api", () => ({
  getClientFromSession: jest.fn(() => ({
    files: { createDownloadUrl: mockCreateDownloadUrl },
  })),
}));

const signedUrl = "https://downloads.example.test/blob";

describe("file inline route", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockCreateDownloadUrl.mockReset();
    mockCreateDownloadUrl.mockResolvedValue({
      data: { data: { attributes: { uri: signedUrl } } },
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("streams inline bytes with the MIME inferred from the file name", async () => {
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    global.fetch = jest.fn(async () =>
      byteResponse(bytes, { "content-length": String(bytes.byteLength) })
    ) as unknown as typeof fetch;

    const res = createResponse();
    await callInline(res, { id: "file-1", name: "photo.png" });

    expect(mockCreateDownloadUrl).toHaveBeenCalledWith({
      id: "file-1",
      createDownloadRequest: {
        data: { type: "download-url", attributes: { expiry: 30 } },
      },
    });
    expect(res.headers["Content-Type"]).toBe("image/png");
    expect(res.headers["Content-Disposition"]).toBe("inline");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(Buffer.isBuffer(res.sent)).toBe(true);
    expect((res.sent as Buffer).equals(bytes)).toBe(true);
  });

  it("sets anti-sniffing and sandbox security headers on success", async () => {
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    global.fetch = jest.fn(async () =>
      byteResponse(bytes, { "content-length": String(bytes.byteLength) })
    ) as unknown as typeof fetch;

    const res = createResponse();
    await callInline(res, { id: "file-1", name: "photo.png" });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(res.headers["Content-Security-Policy"]).toBe(
      "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox;"
    );
  });

  it("rejects non-previewable types (.jt) with 415", async () => {
    global.fetch = jest.fn(async () =>
      byteResponse(Buffer.from("hello"), {})
    ) as unknown as typeof fetch;

    const res = createResponse();
    await callInline(res, { id: "file-1", name: "model.jt" });

    expect(res.status).toHaveBeenCalledWith(415);
    expect(res.jsonBody).toMatchObject({ status: 415 });
    // Rejected before ever asking for a download URL.
    expect(mockCreateDownloadUrl).not.toHaveBeenCalled();
    // Security headers set even on rejection.
    expect(res.headers["X-Content-Type-Options"]).toBe("nosniff");
  });

  it("rejects svg with 415 (never served inline)", async () => {
    global.fetch = jest.fn(async () =>
      byteResponse(Buffer.from("<svg/>"), {})
    ) as unknown as typeof fetch;

    const res = createResponse();
    await callInline(res, { id: "file-1", name: "logo.svg" });

    expect(res.status).toHaveBeenCalledWith(415);
    expect(res.jsonBody).toMatchObject({ status: 415 });
    expect(mockCreateDownloadUrl).not.toHaveBeenCalled();
  });

  it("rejects assets whose declared length exceeds the per-type ceiling with 413", async () => {
    global.fetch = jest.fn(async () =>
      byteResponse(Buffer.from("x"), {
        "content-length": String(PdfPreviewMaxBytes + 1),
      })
    ) as unknown as typeof fetch;

    const res = createResponse();
    await callInline(res, { id: "file-1", name: "big.pdf" });

    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.jsonBody).toMatchObject({ status: 413 });
    expect(res.sent).toBeUndefined();
  });

  it("enforces the text ceiling (5MB) via declared length, below the flat 100MB", async () => {
    global.fetch = jest.fn(async () =>
      byteResponse(Buffer.from("x"), {
        "content-length": String(TextPreviewMaxBytes + 1),
      })
    ) as unknown as typeof fetch;

    const res = createResponse();
    await callInline(res, { id: "file-1", name: "big.txt" });

    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.jsonBody).toMatchObject({ status: 413 });
  });

  it("streams and aborts with 413 when a body without Content-Length exceeds the ceiling", async () => {
    // No content-length header, so the fast path can't reject. The body streams
    // chunks that cumulatively exceed the image ceiling; the route must abort
    // with 413 without buffering the whole (unbounded) body.
    const chunkSize = 1024 * 1024; // 1MB
    const chunkCount = ImagePreviewMaxBytes / chunkSize + 5; // over the 25MB cap
    let produced = 0;
    let cancelled = false;
    const stream = {
      getReader() {
        return {
          read() {
            if (cancelled || produced >= chunkCount) {
              return Promise.resolve({ done: true, value: undefined });
            }
            produced += 1;
            return Promise.resolve({
              done: false,
              value: new Uint8Array(chunkSize),
            });
          },
          cancel() {
            cancelled = true;
            return Promise.resolve();
          },
          releaseLock: jest.fn(),
        };
      },
    };
    global.fetch = jest.fn(async () => ({
      ok: true,
      body: stream,
      headers: new Headers({}),
    })) as unknown as typeof fetch;

    const res = createResponse();
    await callInline(res, { id: "file-1", name: "streamed.png" });

    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.jsonBody).toMatchObject({ status: 413 });
    expect(res.sent).toBeUndefined();
    // The stream was cancelled once the cap tripped, so we never pulled every
    // chunk of the (would-be unbounded) body.
    expect(cancelled).toBe(true);
    expect(produced).toBeLessThan(chunkCount);
  });

  it("returns 405 for non-GET methods", async () => {
    const res = createResponse();
    await callInline(res, { id: "file-1" }, "POST");

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.jsonBody).toMatchObject({ status: 405 });
    expect(mockCreateDownloadUrl).not.toHaveBeenCalled();
  });

  it("returns 400 when the file id is missing", async () => {
    const res = createResponse();
    await callInline(res, {});

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.jsonBody).toMatchObject({ status: 400 });
    expect(mockCreateDownloadUrl).not.toHaveBeenCalled();
  });

  it("returns 500 when no signed URL is produced", async () => {
    mockCreateDownloadUrl.mockResolvedValue({
      data: { data: { attributes: {} } },
    });

    const res = createResponse();
    await callInline(res, { id: "file-1", name: "photo.png" });

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.jsonBody).toMatchObject({ status: 500 });
  });
});

interface MockResponse {
  readonly body: () => unknown;
  headers: Record<string, unknown>;
  jsonBody?: unknown;
  sent?: unknown;
  status: jest.Mock;
  setHeader: jest.Mock;
  json: jest.Mock;
  send: jest.Mock;
}

function createResponse(): MockResponse {
  const res: MockResponse = {
    body: () => res.jsonBody,
    headers: {},
    status: jest.fn(() => res),
    setHeader: jest.fn((key: string, value: unknown) => {
      res.headers[key] = value;
      return res;
    }),
    json: jest.fn((body: unknown) => {
      res.jsonBody = body;
      return res;
    }),
    send: jest.fn((body: unknown) => {
      res.sent = body;
      return res;
    }),
  };
  return res;
}

function byteResponse(
  bytes: Buffer,
  headers: Record<string, string>
): {
  ok: boolean;
  body: unknown;
  headers: Headers;
} {
  // A single-chunk ReadableStream-like body, matching the shape the route reads
  // via `upstream.body.getReader()`.
  let read = false;
  const body = {
    getReader() {
      return {
        read() {
          if (read) return Promise.resolve({ done: true, value: undefined });
          read = true;
          return Promise.resolve({ done: false, value: new Uint8Array(bytes) });
        },
        cancel: jest.fn(() => Promise.resolve()),
        releaseLock: jest.fn(),
      };
    },
  };
  return {
    ok: true,
    body,
    headers: new Headers(headers),
  };
}

function callInline(
  res: MockResponse,
  query: Record<string, string>,
  method = "GET"
): Promise<void> {
  return handleFileInline(
    { method, query, session: {} } as unknown as NextIronRequest,
    res as unknown as NextApiResponse
  );
}
