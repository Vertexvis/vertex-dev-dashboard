export type ResourceOperation = "list" | "get" | "create" | "update" | "remove";

export interface ApiResourceManifestEntry {
  readonly displayName: string;
  readonly group: string;
  readonly list?: {
    readonly defaultPageSize: number;
    readonly filters?: readonly string[];
  };
  readonly moduleGated?: boolean;
  readonly name: string;
  readonly operations: readonly ResourceOperation[];
  readonly preview?: boolean;
  readonly resourceType: string;
  readonly route: string;
}

export interface ApiResourceManifest {
  readonly resources: readonly ApiResourceManifestEntry[];
}

export function isResourceSlug(value: string): boolean {
  return /^[a-z][a-z0-9-]*$/.test(value) && !value.includes("..");
}
