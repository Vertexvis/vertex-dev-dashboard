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
  inferContentType,
  InlinePreviewMaxBytes,
} from "../../../../lib/file-preview";
import { getClientFromSession } from "../../../../lib/vertex-api";
import withSession, { NextIronRequest } from "../../../../lib/with-session";

const DefaultDownloadExpirySeconds = 30;

const PayloadTooLarge: ErrorRes = {
  message: "File is too large to preview in the browser.",
  status: 413,
};

export const config = {
  api: {
    // Streamed binary responses can be large; disable the default 4mb response
    // size limit warning. The InlinePreviewMaxBytes ceiling still applies.
    responseLimit: false,
  },
};

export default withSession(handleFileInline);

/**
 * Streams a file's bytes back to the browser same-origin with `Content-Type`
 * inferred from the file name and `Content-Disposition: inline`, so an
 * `<img>`, `<iframe>`, or pdf.js can render it without CORS or disposition
 * ambiguity. Enforces a hard size ceiling (413) to avoid streaming very large
 * assets. Leaves the download-url/download routes untouched.
 */
export async function handleFileInline(
  req: NextIronRequest,
  res: NextApiResponse<ErrorRes | Buffer>
): Promise<void> {
  if (req.method !== "GET") {
    return res.status(MethodNotAllowed.status).json(MethodNotAllowed);
  }

  try {
    const id = head(req.query.id);
    if (id == null) return res.status(InvalidBody.status).json(InvalidBody);

    const name = head(req.query.name);

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

    const declaredLength = Number(upstream.headers.get("content-length"));
    if (
      Number.isFinite(declaredLength) &&
      declaredLength > InlinePreviewMaxBytes
    ) {
      return res.status(PayloadTooLarge.status).json(PayloadTooLarge);
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    if (buffer.byteLength > InlinePreviewMaxBytes) {
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
