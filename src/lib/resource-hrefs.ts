/**
 * Central source of truth for the dedicated resource-page hrefs. Tables and
 * row-navigation share these so a single edit updates every entry point.
 *
 * Only resources with a dedicated page are represented. Types without one
 * (files, parts, part-revisions, translations) resolve to `undefined`.
 */

export function getSceneHref(id: string): string {
  return `/scene-viewer/${encodeURIComponent(id)}`;
}

export function getSceneWorkspaceHref(id: string): string {
  return `/scene-workspace/${encodeURIComponent(id)}`;
}

export function getFileCollectionHref(id: string): string {
  return `/file-collections/${encodeURIComponent(id)}`;
}

export type ResourceType =
  | "scene"
  | "scene-workspace"
  | "file-collection"
  | "file"
  | "part"
  | "part-revision"
  | "translation";

interface ResourceRef {
  readonly type: ResourceType;
  readonly id: string;
}

/**
 * Returns the dedicated-page href for a resource, or `undefined` when the
 * resource type has no dedicated page (double-click navigation no-ops there).
 */
export function resourceHref({ type, id }: ResourceRef): string | undefined {
  switch (type) {
    case "scene":
      return getSceneHref(id);
    case "scene-workspace":
      return getSceneWorkspaceHref(id);
    case "file-collection":
      return getFileCollectionHref(id);
    default:
      return undefined;
  }
}
