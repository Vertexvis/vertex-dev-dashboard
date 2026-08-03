import type { Cursors } from "@vertexvis/api-client-node";

/** Public API response contracts. Keep these wire shapes stable. */
export interface Res {
  readonly status: number;
}

export interface ErrorRes extends Res {
  readonly message: string;
}

export interface GetRes<T> extends Res {
  readonly cursors: Cursors;
  readonly data: T[];
}

export interface DeleteReq {
  readonly ids: string[];
}

export type RouteResult<T extends Res> = T;
