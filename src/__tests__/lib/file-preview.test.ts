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
      "a.bmp",
      "a.ico",
      "a.avif",
      "a.BMP",
      "a.AVIF",
    ]) {
      expect(getPreviewType(name)).toBe("image");
    }
  });

  it("does not classify svg as previewable (XSS hardening)", () => {
    // SVG can embed <script>; it must never be served inline. See
    // src/pages/api/files/[id]/inline.ts.
    expect(getPreviewType("a.svg")).toBeNull();
    expect(getPreviewType("logo.SVG")).toBeNull();
  });

  it("classifies pdf, text, and heic extensions", () => {
    expect(getPreviewType("a.pdf")).toBe("pdf");
    for (const name of ["a.txt", "a.json", "a.csv", "a.log", "a.xml"]) {
      expect(getPreviewType(name)).toBe("text");
    }
    expect(getPreviewType("a.heic")).toBe("heic");
    expect(getPreviewType("a.HEIF")).toBe("heic");
  });

  it("classifies markdown, data, and code extensions as text", () => {
    for (const name of [
      "a.md",
      "a.markdown",
      "a.yaml",
      "a.yml",
      "a.tsv",
      "a.tab",
      "a.js",
      "a.jsx",
      "a.ts",
      "a.tsx",
      "a.css",
      "a.html",
      "a.htm",
      "a.sh",
      "a.py",
      "a.sql",
      "a.ini",
      "a.toml",
      "a.env",
      "README.MD",
      "index.HTML",
      "script.JS",
    ]) {
      expect(getPreviewType(name)).toBe("text");
    }
  });

  it("classifies html/js/css as text (never an executable type)", () => {
    // These are code/markup extensions. They must resolve to the non-executable
    // "text" preview type so they are rendered as escaped text, never run.
    for (const name of ["page.html", "page.htm", "app.js", "styles.css"]) {
      expect(getPreviewType(name)).toBe("text");
    }
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
  const PlainText = "text/plain; charset=utf-8";

  it("infers image MIME from the extension (browser-native only)", () => {
    expect(inferContentType("a.png")).toBe("image/png");
    expect(inferContentType("a.jpg")).toBe("image/jpeg");
    expect(inferContentType("a.jpeg")).toBe("image/jpeg");
    expect(inferContentType("a.gif")).toBe("image/gif");
    expect(inferContentType("a.webp")).toBe("image/webp");
    expect(inferContentType("a.bmp")).toBe("image/bmp");
    expect(inferContentType("a.ico")).toBe("image/vnd.microsoft.icon");
    expect(inferContentType("a.avif")).toBe("image/avif");
    expect(inferContentType("a.pdf")).toBe("application/pdf");
    expect(inferContentType("a.heic")).toBe("image/heic");
  });

  it("serves ALL text/code extensions as non-executable text/plain", () => {
    // Security-critical: code and markup extensions must be served with a
    // non-executable content type so they never run in the app's own origin.
    for (const name of [
      "a.txt",
      "a.log",
      "a.csv",
      "a.json",
      "a.xml",
      "a.md",
      "a.markdown",
      "a.yaml",
      "a.yml",
      "a.tsv",
      "a.tab",
      "a.js",
      "a.jsx",
      "a.ts",
      "a.tsx",
      "a.css",
      "a.html",
      "a.htm",
      "a.sh",
      "a.py",
      "a.sql",
      "a.ini",
      "a.toml",
      "a.env",
    ]) {
      expect(inferContentType(name)).toBe(PlainText);
    }
  });

  it("never serves html/htm/js/css as an executable/renderable type", () => {
    // Explicit guard: text/html and application/javascript would execute in the
    // origin. These must be plain text.
    expect(inferContentType("page.html")).toBe(PlainText);
    expect(inferContentType("page.htm")).toBe(PlainText);
    expect(inferContentType("app.js")).toBe(PlainText);
    expect(inferContentType("styles.css")).toBe(PlainText);
    expect(inferContentType("page.html")).not.toBe("text/html");
    expect(inferContentType("app.js")).not.toBe("application/javascript");
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

  it("allows newly-added image and text formats", () => {
    for (const name of ["icon.bmp", "next-gen.avif", "favicon.ico"]) {
      const result = canPreview(makeFile({ name, size: 1024 }), ChromeUA);
      expect(result).toEqual({ ok: true, type: "image" });
    }
    for (const name of ["notes.md", "config.yaml", "app.tsx", "page.html"]) {
      const result = canPreview(makeFile({ name, size: 1024 }), ChromeUA);
      expect(result).toEqual({ ok: true, type: "text" });
    }
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

  it("blocks svg (download-only) to avoid inline XSS", () => {
    const result = canPreview(makeFile({ name: "logo.svg" }), ChromeUA);
    expect(result.ok).toBe(false);
    expect(result.type).toBeUndefined();
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
