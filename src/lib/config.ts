import { Environment } from "@vertexvis/viewer";

export interface AccountCredentials {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly vertexEnv: Environment;
}

export interface StreamCredentials {
  readonly clientId: string;
  readonly streamKey: string;
  readonly vertexEnv: Environment;
}

export function head<T>(items?: T | T[]): T | undefined {
  return Array.isArray(items) ? items[0] : items ?? undefined;
}
