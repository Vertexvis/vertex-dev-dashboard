import { Environment } from "@vertexvis/viewer";

export interface Configuration {
  readonly clientId: string;
  readonly vertexEnv: Environment;
}

export interface StreamCredentials {
  readonly clientId: string;
  readonly streamKey: string;
}

export const Config: Configuration = {
  clientId: envVar("VERTEX_CLIENT_ID", ""),
  vertexEnv: envVar("VERTEX_ENV", "platprod") as Environment,
};

export function head<T>(items?: T | T[]): T | undefined {
  return Array.isArray(items) ? items[0] : items ?? undefined;
}

function envVar(name: string, fallback: string): string {
  const ev = process.env[name];
  return ev ? ev : fallback;
}
