import { Cursors } from "@vertexvis/api-client-node";

import { GetRes } from "./api";

export interface Paged<T> {
  readonly cursors: Cursors | null; // Must use null for proper NextJS serialization
  readonly items: T[];
}

export interface SwrProps {
  readonly cursor?: string;
  readonly pageSize: number;
  readonly suppliedId?: string;
  readonly name?: string;
}

export function toPage<T extends { attributes: TA; id: string }, TA>({
  cursors,
  data,
}: GetRes<T>): Paged<TA & Pick<T, "id">> {
  return {
    cursors: cursors ?? null,
    items: data.map(({ id, attributes }) => ({ ...attributes, id })),
  };
}
