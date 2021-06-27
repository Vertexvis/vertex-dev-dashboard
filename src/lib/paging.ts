import { GetRes } from "./api";

export interface Paged<T> {
  readonly cursor: string | null; // Must use null for proper NextJS serialization
  readonly items: T[];
}

export interface SwrProps {
  readonly cursor?: string;
  readonly pageSize: number;
  readonly suppliedId?: string;
}

export function toPage<T extends { attributes: TA; id: string }, TA>({
  cursor,
  data,
}: GetRes<T>): Paged<TA & Pick<T, "id">> {
  return {
    cursor: cursor ?? null,
    items: data.map(({ id, attributes }) => ({ ...attributes, id })),
  };
}
