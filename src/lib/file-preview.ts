import { File, isCompleteFileStatus } from "./files";
import { toFileSizeDisplay } from "./formatting";

export type PreviewType = "image" | "pdf" | "text" | "heic";

// NOTE: `svg` is intentionally excluded. SVG can embed <script>, so serving it
// inline as image/svg+xml on the app's own origin is a stored-XSS primitive.
// SVGs are download-only; see src/pages/api/files/[id]/inline.ts.
//
// Only browser-native raster formats are allowed here (rendered via <img>).
// Formats browsers can't decode natively (tiff, psd, camera raw) are excluded.
const ImageExtensions = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "bmp",
  "ico",
  "avif",
]);
const PdfExtensions = new Set(["pdf"]);
// Text/code extensions are ALL rendered as plain text in a <pre> and served
// with a non-executable content type (text/plain; charset=utf-8). This is
// deliberate: html/htm/js/jsx/ts/tsx/css/etc. must NEVER be served with an
// executable/renderable content type on the app's own origin (XSS vector).
// See MimeByExtension below and src/pages/api/files/[id]/inline.ts.
const TextExtensions = new Set([
  "txt",
  "json",
  "csv",
  "log",
  "xml",
  "md",
  "markdown",
  "yaml",
  "yml",
  "tsv",
  "tab",
  "js",
  "jsx",
  "ts",
  "tsx",
  "css",
  "html",
  "htm",
  "sh",
  "py",
  "sql",
  "ini",
  "toml",
  "env",
]);
const HeicExtensions = new Set(["heic", "heif"]);

const MB = 1024 * 1024;

/**
 * Per-type size ceilings for in-browser preview. These are intentionally
 * conservative (evidence-lean) so a large asset is downloaded rather than
 * streamed and rendered in the browser.
 */
export const ImagePreviewMaxBytes = 25 * MB;
export const PdfPreviewMaxBytes = 100 * MB;
export const TextPreviewMaxBytes = 5 * MB;

/**
 * The largest number of bytes any previewable asset may have. Used by the
 * inline byte-proxy route as a hard ceiling regardless of type.
 */
export const InlinePreviewMaxBytes = PdfPreviewMaxBytes;

export function extensionOf(name?: string): string | undefined {
  if (name == null) return undefined;
  const dot = name.lastIndexOf(".");
  if (dot < 0 || dot === name.length - 1) return undefined;
  return name.slice(dot + 1).toLowerCase();
}

export function getPreviewType(name?: string): PreviewType | null {
  const ext = extensionOf(name);
  if (ext == null) return null;
  if (ImageExtensions.has(ext)) return "image";
  if (PdfExtensions.has(ext)) return "pdf";
  if (TextExtensions.has(ext)) return "text";
  if (HeicExtensions.has(ext)) return "heic";
  return null;
}

// Non-executable text content type used for EVERY text/code extension. Serving
// html/htm/js/jsx/ts/tsx/css/etc. as anything renderable/executable (e.g.
// text/html or application/javascript) on the app's own origin would be an XSS
// vector, so they are all pinned to text/plain and rendered as escaped text.
const PlainText = "text/plain; charset=utf-8";

const MimeByExtension: Record<string, string> = {
  // Images: browser-native raster formats only, rendered via <img>.
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  ico: "image/vnd.microsoft.icon",
  avif: "image/avif",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
  // Text/code: all served as non-executable plain text (see PlainText note).
  txt: PlainText,
  log: PlainText,
  csv: PlainText,
  json: PlainText,
  xml: PlainText,
  md: PlainText,
  markdown: PlainText,
  yaml: PlainText,
  yml: PlainText,
  tsv: PlainText,
  tab: PlainText,
  js: PlainText,
  jsx: PlainText,
  ts: PlainText,
  tsx: PlainText,
  css: PlainText,
  html: PlainText,
  htm: PlainText,
  sh: PlainText,
  py: PlainText,
  sql: PlainText,
  ini: PlainText,
  toml: PlainText,
  env: PlainText,
};

/**
 * Infers a MIME type from a file name's extension. Falls back to
 * `application/octet-stream` when the extension is unknown, since there is no
 * native content type on the File resource.
 */
export function inferContentType(name?: string): string {
  const ext = extensionOf(name);
  if (ext == null) return "application/octet-stream";
  return MimeByExtension[ext] ?? "application/octet-stream";
}

export function maxBytesForPreviewType(type: PreviewType): number {
  switch (type) {
    case "image":
    case "heic":
      return ImagePreviewMaxBytes;
    case "pdf":
      return PdfPreviewMaxBytes;
    case "text":
      return TextPreviewMaxBytes;
  }
}

/**
 * Safari (including iOS/iPadOS) detection from a User-Agent string. Chrome,
 * Chromium, Edge, and Android WebViews all include "Safari" in their UA, so
 * they must be excluded. Accepts the UA as an argument so it stays testable
 * without stubbing `navigator`.
 */
export function isSafariUserAgent(userAgent?: string): boolean {
  if (userAgent == null || userAgent.length === 0) return false;
  const hasSafari = /safari/i.test(userAgent);
  const isOtherEngine =
    /chrom(e|ium)/i.test(userAgent) ||
    /crios/i.test(userAgent) ||
    /android/i.test(userAgent) ||
    /edg\//i.test(userAgent) ||
    /fxios/i.test(userAgent) ||
    /firefox/i.test(userAgent);
  return hasSafari && !isOtherEngine;
}

function currentIsSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  return isSafariUserAgent(navigator.userAgent);
}

export interface CanPreviewResult {
  readonly ok: boolean;
  readonly reason?: string;
  readonly type?: PreviewType;
}

/**
 * Whether a file can be previewed inline in the browser, and if not, a
 * human-readable reason. Gates, in order: upload status, known previewable
 * type, HEIC browser support, and per-type size ceiling.
 *
 * @param userAgent optional UA override for testability; defaults to
 *   `navigator.userAgent`.
 */
export function canPreview(file: File, userAgent?: string): CanPreviewResult {
  if (!isCompleteFileStatus(file.status)) {
    return { ok: false, reason: "File is not ready" };
  }

  const type = getPreviewType(file.name);
  if (type == null) {
    return {
      ok: false,
      reason: "This file type can't be previewed in the browser",
    };
  }

  if (type === "heic") {
    const safari =
      userAgent != null ? isSafariUserAgent(userAgent) : currentIsSafari();
    if (!safari) {
      return {
        ok: false,
        reason: "HEIC preview is only supported in Safari",
        type,
      };
    }
  }

  const max = maxBytesForPreviewType(type);
  if (file.size != null && file.size > max) {
    return {
      ok: false,
      reason: `File is too large to preview (${toFileSizeDisplay(
        file.size
      )}); download to view`,
      type,
    };
  }

  return { ok: true, type };
}
