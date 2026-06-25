import { Cursors } from "@vertexvis/api-client-node";
import React from "react";

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

type QueryValue = number | string | undefined;
const QueryParamOrder = ["pageSize", "cursor", "sort", "suppliedId", "name"];

export function buildQuery(
  path: string,
  params: Record<string, QueryValue>
): string {
  const query = new URLSearchParams();
  const entries = Object.entries(params).sort(([leftKey], [rightKey]) => {
    const leftIndex = QueryParamOrder.indexOf(leftKey);
    const rightIndex = QueryParamOrder.indexOf(rightKey);

    if (leftIndex === -1 && rightIndex === -1) return leftKey.localeCompare(rightKey);
    if (leftIndex === -1) return 1;
    if (rightIndex === -1) return -1;
    return leftIndex - rightIndex;
  });

  entries.forEach(([key, value]) => {
    if (value != null && value !== "") {
      query.set(key, value.toString());
    }
  });

  const search = query.toString();
  return search === "" ? path : `${path}?${search}`;
}

export function useCursorPagingState(): {
  readonly currentPage: number;
  readonly cursor?: string;
  readonly cursors?: Cursors;
  readonly handlePageChange: (
    nextPage: number
  ) => void;
  readonly resetPaging: () => void;
  readonly setCursors: React.Dispatch<React.SetStateAction<Cursors | undefined>>;
} {
  const [currentPage, setCurrentPage] = React.useState(0);
  const [cursor, setCursor] = React.useState<string | undefined>();
  const [cursors, setCursors] = React.useState<Cursors | undefined>();
  const [previous, setPrevious] = React.useState<
    Record<number, string | undefined>
  >({});

  const resetPaging = React.useCallback(() => {
    setCurrentPage(0);
    setCursor(undefined);
    setCursors(undefined);
    setPrevious({});
  }, []);

  const handlePageChange = React.useCallback(
    (nextPage: number) => {
      if (currentPage < nextPage) {
        setPrevious((current) => ({ ...current, [nextPage - 1]: cursors?.self }));
        setCursor(cursors?.next);
      } else if (currentPage > nextPage) {
        setCursor(previous[nextPage]);
      }

      setCurrentPage(nextPage);
    },
    [currentPage, cursors, previous]
  );

  return { currentPage, cursor, cursors, handlePageChange, resetPaging, setCursors };
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
