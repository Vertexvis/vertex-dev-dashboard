import { Close, Download } from "@mui/icons-material";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from "@mui/material";
import React from "react";

import { canPreview, PreviewType } from "../../lib/file-preview";
import { File } from "../../lib/files";

interface Props {
  readonly file?: File;
  readonly onClose: () => void;
  readonly open: boolean;
}

function inlineUrl(file: File): string {
  const base = `/api/files/${encodeURIComponent(file.id)}/inline`;
  return file.name != null
    ? `${base}?name=${encodeURIComponent(file.name)}`
    : base;
}

function downloadUrl(file: File): string {
  return `/api/files/${encodeURIComponent(file.id)}/download`;
}

export function FilePreviewDialog({ file, onClose, open }: Props): JSX.Element {
  const preview = file != null ? canPreview(file) : undefined;

  return (
    <Dialog fullWidth maxWidth="lg" onClose={onClose} open={open}>
      <DialogTitle
        sx={{
          alignItems: "center",
          display: "flex",
          justifyContent: "space-between",
          gap: 2,
        }}
      >
        <Box sx={{ overflowWrap: "anywhere", pr: 2 }}>
          {file?.name ?? "Preview"}
        </Box>
        <IconButton aria-label="Close preview" onClick={onClose}>
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent
        dividers
        sx={{
          display: "flex",
          justifyContent: "center",
          minHeight: 240,
        }}
      >
        {file != null && preview != null && (
          <PreviewBody
            file={file}
            previewOk={preview.ok}
            reason={preview.reason}
            type={preview.type}
          />
        )}
      </DialogContent>
      <DialogActions>
        {file != null && (
          <Button
            component="a"
            href={downloadUrl(file)}
            startIcon={<Download />}
            variant="contained"
          >
            Download
          </Button>
        )}
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

function PreviewBody({
  file,
  previewOk,
  reason,
  type,
}: {
  readonly file: File;
  readonly previewOk: boolean;
  readonly reason?: string;
  readonly type?: PreviewType;
}): JSX.Element {
  if (!previewOk) {
    return (
      <PreviewMessage message={reason ?? "This file can't be previewed."} />
    );
  }

  switch (type) {
    case "image":
    case "heic":
      return <ImagePreview file={file} />;
    case "pdf":
      return <PdfPreview file={file} />;
    case "text":
      return <TextPreview file={file} />;
    default:
      return (
        <PreviewMessage message="This file type can't be previewed in the browser." />
      );
  }
}

function PreviewMessage({
  message,
}: {
  readonly message: string;
}): JSX.Element {
  return (
    <Box
      sx={{ alignItems: "center", display: "flex", justifyContent: "center" }}
    >
      <Typography variant="body1">{message}</Typography>
    </Box>
  );
}

function PreviewLoading(): JSX.Element {
  return (
    <Box
      sx={{ alignItems: "center", display: "flex", justifyContent: "center" }}
    >
      <CircularProgress />
    </Box>
  );
}

function ImagePreview({ file }: { readonly file: File }): JSX.Element {
  const [loading, setLoading] = React.useState(true);
  const [failed, setFailed] = React.useState(false);

  if (failed) {
    return (
      <PreviewMessage message="Couldn't preview this file — download it to view." />
    );
  }

  return (
    <>
      {loading && <PreviewLoading />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt={file.name ?? "File preview"}
        src={inlineUrl(file)}
        onError={() => {
          setLoading(false);
          setFailed(true);
        }}
        onLoad={() => setLoading(false)}
        style={{
          display: loading ? "none" : "block",
          maxHeight: "70vh",
          maxWidth: "100%",
          objectFit: "contain",
        }}
      />
    </>
  );
}

const TextPreviewMaxChars = 200_000;

function TextPreview({ file }: { readonly file: File }): JSX.Element {
  const [state, setState] = React.useState<{
    readonly status: "loading" | "loaded" | "error";
    readonly text?: string;
  }>({ status: "loading" });

  React.useEffect(() => {
    let active = true;
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch(inlineUrl(file), { signal: controller.signal });
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        const text = await res.text();
        if (active) setState({ status: "loaded", text });
      } catch (err) {
        if (active && (err as Error).name !== "AbortError") {
          setState({ status: "error" });
        }
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [file]);

  if (state.status === "loading") return <PreviewLoading />;
  if (state.status === "error") {
    return (
      <PreviewMessage message="Couldn't preview this file — download it to view." />
    );
  }

  const text = state.text ?? "";
  const truncated = text.length > TextPreviewMaxChars;

  return (
    <Box sx={{ width: "100%" }}>
      <Box
        component="pre"
        sx={{
          fontSize: "0.8rem",
          m: 0,
          maxHeight: "70vh",
          overflow: "auto",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {truncated ? text.slice(0, TextPreviewMaxChars) : text}
      </Box>
      {truncated && (
        <Typography color="text.secondary" sx={{ mt: 1 }} variant="caption">
          Preview truncated. Download to view the full file.
        </Typography>
      )}
    </Box>
  );
}

function PdfPreview({ file }: { readonly file: File }): JSX.Element {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = React.useState<"loading" | "loaded" | "error">(
    "loading"
  );

  React.useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        // The pdf.js ESM worker can't be bundled by Next's webpack+Babel setup
        // (it's treated as an ESM external and fails the build). Instead the
        // worker is copied into /public by scripts/copy-pdf-worker.mjs and
        // served from a stable same-origin URL.
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf/pdf.worker.min.mjs";

        const loadingTask = pdfjs.getDocument(inlineUrl(file));
        cleanup = () => void loadingTask.destroy();
        const doc = await loadingTask.promise;
        if (cancelled) return;

        const pdfPage = await doc.getPage(1);
        if (cancelled) return;

        const canvas = canvasRef.current;
        if (canvas == null) return;
        const context = canvas.getContext("2d");
        if (context == null) return;

        const viewport = pdfPage.getViewport({ scale: 1.5 });
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await pdfPage.render({ canvasContext: context, viewport }).promise;
        if (!cancelled) setStatus("loaded");
      } catch (err) {
        if (
          !cancelled &&
          (err as Error)?.name !== "RenderingCancelledException"
        ) {
          setStatus("error");
        }
      }
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [file]);

  return (
    <Box sx={{ position: "relative", width: "100%" }}>
      {status === "loading" && <PreviewLoading />}
      {status === "error" ? (
        <PreviewMessage message="Couldn't preview this PDF — download it to view." />
      ) : (
        <Box
          sx={{ display: "flex", justifyContent: "center", overflow: "auto" }}
        >
          <canvas
            ref={canvasRef}
            aria-label={`PDF preview of ${file.name ?? "file"}`}
            style={{
              display: status === "loaded" ? "block" : "none",
              maxWidth: "100%",
            }}
          />
        </Box>
      )}
    </Box>
  );
}
