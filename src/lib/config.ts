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

export function isValidHttpUrl(givenUrl?: string): boolean {
  if (givenUrl == null) {
    return false;
  }

  try {
    const url = new URL(givenUrl);

    return (
      url.protocol === "http:" ||
      url.protocol === "https:" ||
      url.protocol === "ws:" ||
      url.protocol === "wss:"
    );
  } catch (_) {
    return false;
  }
}

export function isValidHttpUrlNullable(givenUrl?: string): boolean {
  if (givenUrl == null || givenUrl.trim() === "") {
    return true;
  }
  return isValidHttpUrl(givenUrl);
}
