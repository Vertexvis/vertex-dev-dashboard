#!/usr/bin/env node
// Copies the pdf.js worker out of node_modules into /public so the browser can
// load it from a stable, same-origin URL (/pdf/pdf.worker.min.mjs).
//
// Next.js (webpack + Babel here) refuses to bundle the pdf.js ESM worker via
// `new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url)` — it treats
// the .mjs worker as an ESM external and fails the build. Copying the prebuilt
// worker asset into /public sidesteps the bundler entirely; the client sets
// `pdfjs.GlobalWorkerOptions.workerSrc = "/pdf/pdf.worker.min.mjs"`.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(
  root,
  "node_modules",
  "pdfjs-dist",
  "build",
  "pdf.worker.min.mjs"
);
const destDir = join(root, "public", "pdf");
const dest = join(destDir, "pdf.worker.min.mjs");

if (!existsSync(source)) {
  // node_modules may not be installed yet (e.g. a bare checkout). Don't fail
  // the whole install/build over a missing optional asset.
  console.warn(`[copy-pdf-worker] source not found, skipping: ${source}`);
  process.exit(0);
}

mkdirSync(destDir, { recursive: true });
copyFileSync(source, dest);
console.log(`[copy-pdf-worker] copied worker to ${dest}`);
