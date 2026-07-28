import { readFile } from "fs/promises";
import { join } from "path";

import { ViewerSdkGuide } from "./viewer-sdk-guide";

const TypingFiles = [
  "lib/scenes/queries.d.ts",
  "lib/scenes/operations.d.ts",
  "lib/scenes/scene.d.ts",
  "lib/scenes/camera.d.ts",
  "lib/scene-items/controller.d.ts",
  "lib/scene-items/types.d.ts",
  "components/scene-tree/lib/controller.d.ts",
  "components/scene-tree/types.d.ts",
];

let cachedTypings: Promise<string> | undefined;

/**
 * Supplies Claude with the complete installed Viewer declaration surface.
 * This runs only in the Next.js API route and is never sent to the browser.
 */
export function getViewerSdkTypings(): Promise<string> {
  cachedTypings ??= Promise.all(
    TypingFiles.map(async (file) => {
      const path = join(
        process.cwd(),
        "node_modules/@vertexvis/viewer/dist/types",
        file
      );
      return `// @vertexvis/viewer/dist/types/${file}\n${await readFile(
        path,
        "utf8"
      )}`;
    })
  )
    .then((files) => files.join("\n\n"))
    .catch(() => ViewerSdkGuide);
  return cachedTypings;
}
