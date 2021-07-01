import { Environment } from "@vertexvis/viewer";

export interface Configuration {
  readonly vertexEnv: Environment;
}

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

export const Config: Configuration = {
  vertexEnv: envVar("VERTEX_ENV", "platprod") as Environment,
};

function envVar(name: string, fallback: string): string {
  const ev = process.env[name];
  return ev ? ev : fallback;
}

export function head<T>(items?: T | T[]): T | undefined {
  return Array.isArray(items) ? items[0] : items ?? undefined;
}
