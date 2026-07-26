import {
  canPreview,
  getPreviewType,
  ImagePreviewMaxBytes,
  inferContentType,
  InlinePreviewMaxBytes,
  isSafariUserAgent,
  maxBytesForPreviewType,
  PdfPreviewMaxBytes,
  TextPreviewMaxBytes,
} from "../../lib/file-preview";
import { File } from "../../lib/files";

const SafariUA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15";
const ChromeUA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const AndroidUA =
  "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.0.0 Mobile Safari/537.36";
const FirefoxUA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:125.0) Gecko/20100101 Firefox/125.0";

function makeFile(overrides: Partial<File> = {}): File {
  return {
    created: "2026-07-21T12:00:00Z",
    id: "file-1",
    name: "sample.png",
    status: "complete",
    suppliedId: "supplied-1",
    uploaded: "2026-07-21T12:01:00Z",
    ...overrides,
  } as unknown as File;
}

describe("getPreviewType", () => {
  it("classifies image extensions", () => {
    for (const name of [
      "a.png",
      "a.jpg",
      "a.JPEG",
      "a.gif",
      "a.webp",
      "a.svg",
    ]) {
      expect(getPreviewType(name)).toBe("image");
    }
  });

  it("classifies pdf, text, and heic extensions", () => {
    expect(getPreviewType("a.pdf")).toBe("pdf");
    for (const name of ["a.txt", "a.json", "a.csv", "a.log", "a.xml"]) {
      expect(getPreviewType(name)).toBe("text");
    }
    expect(getPreviewType("a.heic")).toBe("heic");
    expect(getPreviewType("a.HEIF")).toBe("heic");
  });

  it("returns null for unknown or missing extensions", () => {
    expect(getPreviewType("model.jt")).toBeNull();
    expect(getPreviewType("model.step")).toBeNull();
    expect(getPreviewType("noextension")).toBeNull();
    expect(getPreviewType(undefined)).toBeNull();
    expect(getPreviewType("trailingdot.")).toBeNull();
  });
});

describe("size ceilings", () => {
  it("exposes the documented per-type ceilings", () => {
    expect(ImagePreviewMaxBytes).toBe(25 * 1024 * 1024);
    expect(PdfPreviewMaxBytes).toBe(100 * 1024 * 1024);
    expect(TextPreviewMaxBytes).toBe(5 * 1024 * 1024);
    expect(InlinePreviewMaxBytes).toBe(PdfPreviewMaxBytes);
  });

  it("maps preview types to their ceilings", () => {
    expect(maxBytesForPreviewType("image")).toBe(ImagePreviewMaxBytes);
    expect(maxBytesForPreviewType("heic")).toBe(ImagePreviewMaxBytes);
    expect(maxBytesForPreviewType("pdf")).toBe(PdfPreviewMaxBytes);
    expect(maxBytesForPreviewType("text")).toBe(TextPreviewMaxBytes);
  });
});

describe("inferContentType", () => {
  it("infers MIME from the extension", () => {
    expect(inferContentType("a.png")).toBe("image/png");
    expect(inferContentType("a.jpg")).toBe("image/jpeg");
    expect(inferContentType("a.jpeg")).toBe("image/jpeg");
    expect(inferContentType("a.svg")).toBe("image/svg+xml");
    expect(inferContentType("a.pdf")).toBe("application/pdf");
    expect(inferContentType("a.txt")).toBe("text/plain");
    expect(inferContentType("a.json")).toBe("application/json");
    expect(inferContentType("a.heic")).toBe("image/heic");
  });

  it("falls back to octet-stream for unknown or missing extensions", () => {
    expect(inferContentType("a.jt")).toBe("application/octet-stream");
    expect(inferContentType(undefined)).toBe("application/octet-stream");
  });
});

describe("isSafariUserAgent", () => {
  it("is true for desktop Safari", () => {
    expect(isSafariUserAgent(SafariUA)).toBe(true);
  });

  it("is false for Chrome, Android WebView, and Firefox", () => {
    expect(isSafariUserAgent(ChromeUA)).toBe(false);
    expect(isSafariUserAgent(AndroidUA)).toBe(false);
    expect(isSafariUserAgent(FirefoxUA)).toBe(false);
    expect(isSafariUserAgent(undefined)).toBe(false);
    expect(isSafariUserAgent("")).toBe(false);
  });
});

describe("canPreview", () => {
  it("allows a complete, in-bounds image", () => {
    const result = canPreview(makeFile({ size: 1024 }), ChromeUA);
    expect(result).toEqual({ ok: true, type: "image" });
  });

  it("blocks files that are not complete", () => {
    const result = canPreview(makeFile({ status: "pending" }), ChromeUA);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("File is not ready");
  });

  it("blocks unknown file types", () => {
    const result = canPreview(makeFile({ name: "model.jt" }), ChromeUA);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe(
      "This file type can't be previewed in the browser"
    );
  });

  it("blocks HEIC outside Safari but allows it in Safari", () => {
    const blocked = canPreview(makeFile({ name: "photo.heic" }), ChromeUA);
    expect(blocked.ok).toBe(false);
    expect(blocked.reason).toBe("HEIC preview is only supported in Safari");

    const allowed = canPreview(makeFile({ name: "photo.heic" }), SafariUA);
    expect(allowed.ok).toBe(true);
    expect(allowed.type).toBe("heic");
  });

  it("blocks files over their type ceiling with the size in the message", () => {
    const result = canPreview(
      makeFile({ name: "big.png", size: ImagePreviewMaxBytes + 1 }),
      ChromeUA
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("File is too large to preview");
    expect(result.reason).toContain("download to view");
  });

  it("allows files with unknown size", () => {
    const result = canPreview(makeFile({ size: undefined }), ChromeUA);
    expect(result.ok).toBe(true);
  });
});
