import { head, logError, VertexError } from "@vertexvis/api-client-node";
import { NextApiResponse } from "next";

import {
  ErrorRes,
  InvalidBody,
  MethodNotAllowed,
  ServerError,
  toErrorRes,
} from "../../../../lib/api";
import {
  getPreviewType,
  inferContentType,
  maxBytesForPreviewType,
} from "../../../../lib/file-preview";
import { getClientFromSession } from "../../../../lib/vertex-api";
import withSession, { NextIronRequest } from "../../../../lib/with-session";

const DefaultDownloadExpirySeconds = 30;

const PayloadTooLarge: ErrorRes = {
  message: "File is too large to preview in the browser.",
  status: 413,
};

const UnsupportedMediaType: ErrorRes = {
  message: "This file type can't be previewed in the browser.",
  status: 415,
};

/**
 * Security headers applied to every inline response. Defense-in-depth so that
 * even if a byte stream is opened directly (e.g. by navigating to the URL),
 * the browser cannot sniff it into an executable type or run embedded scripts.
 *
 * - `nosniff` forces the declared Content-Type to be honored.
 * - The CSP `sandbox` directive neutralizes script execution if the resource
 *   is loaded as a top-level document, and `default-src 'none'` locks down
 *   sub-resource loads. The in-app <img>/<canvas>/<pre> viewer is unaffected
 *   because it renders in the app page's own context (this CSP scopes only to
 *   the /inline response document, not the page that fetches it).
 */
function setSecurityHeaders(res: NextApiResponse): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox;"
  );
}

export const config = {
  api: {
    // Streamed binary responses can be large; disable the default 4mb response
    // size limit warning. The per-type preview ceiling still applies.
    responseLimit: false,
  },
};

export default withSession(handleFileInline);

/**
 * Streams a file's bytes back to the browser same-origin with `Content-Type`
 * inferred from the file name and `Content-Disposition: inline`, so an
 * `<img>`, `<iframe>`, or pdf.js can render it without CORS or disposition
 * ambiguity.
 *
 * Defense-in-depth mirroring the client `canPreview` gate:
 * - Only previewable types are served; anything else is rejected with 415.
 * - The per-type size ceiling (image 25MB, pdf 100MB, text 5MB) is enforced
 *   both up front against the declared Content-Length and while streaming, so
 *   memory is bounded by the ceiling even when the upstream lies about (or
 *   omits) its length.
 * - Every response carries anti-sniffing / anti-execution security headers.
 *
 * Leaves the download-url/download routes untouched.
 */
export async function handleFileInline(
  req: NextIronRequest,
  res: NextApiResponse<ErrorRes | Buffer>
): Promise<void> {
  if (req.method !== "GET") {
    setSecurityHeaders(res);
    return res.status(MethodNotAllowed.status).json(MethodNotAllowed);
  }

  setSecurityHeaders(res);

  try {
    const id = head(req.query.id);
    if (id == null) return res.status(InvalidBody.status).json(InvalidBody);

    const name = head(req.query.name);

    // Server-side mirror of the client `canPreview` type gate: only serve types
    // the viewer would actually render, and pick the matching size ceiling.
    const previewType = getPreviewType(name);
    if (previewType == null) {
      return res
        .status(UnsupportedMediaType.status)
        .json(UnsupportedMediaType);
    }
    const maxBytes = maxBytesForPreviewType(previewType);

    const client = await getClientFromSession(req.session);
    const downloadRes = await client.files.createDownloadUrl({
      id,
      createDownloadRequest: {
        data: {
          type: "download-url",
          attributes: { expiry: DefaultDownloadExpirySeconds },
        },
      },
    });
    const url =
      downloadRes.data.data.attributes.uri ??
      downloadRes.data.data.attributes.downloadUrl;
    if (url == null) return res.status(ServerError.status).json(ServerError);

    const upstream = await fetch(url);
    if (!upstream.ok || upstream.body == null) {
      return res.status(ServerError.status).json(ServerError);
    }

    // Fast path: reject up front when the upstream declares a length over the
    // ceiling, before reading any body bytes.
    const declaredLength = Number(upstream.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      return res.status(PayloadTooLarge.status).json(PayloadTooLarge);
    }

    // Stream the body, accumulating chunks and aborting as soon as the
    // cumulative size exceeds the ceiling. This bounds memory by `maxBytes`
    // regardless of whether the upstream sent an (accurate) Content-Length.
    const buffer = await readCappedBody(upstream.body, maxBytes);
    if (buffer == null) {
      return res.status(PayloadTooLarge.status).json(PayloadTooLarge);
    }

    res.setHeader("Content-Type", inferContentType(name));
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("Content-Length", buffer.byteLength);
    res.status(200).send(buffer);
    return;
  } catch (error) {
    const e = error as VertexError;
    logError(e);
    const response = e.vertexError?.res
      ? toErrorRes({ failure: e.vertexError.res })
      : ServerError;
    return res.status(response.status).json(response);
  }
}

/**
 * Reads a web `ReadableStream` into a Buffer, aborting (returning null) as soon
 * as the cumulative byte count exceeds `maxBytes`. Cancels the stream on
 * overflow so no further bytes are pulled. Never buffers more than `maxBytes`
 * (plus the final chunk that trips the limit), so memory stays bounded even
 * when the upstream Content-Length is absent or dishonest.
 */
async function readCappedBody(
  body: ReadableStream<Uint8Array>,
  maxBytes: number
): Promise<Buffer | null> {
  const reader = body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value == null) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total);
}
