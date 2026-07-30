import { Cursors } from "@vertexvis/api-client-node";
import React from "react";

import { GetRes } from "./api";
import { queryParamValue } from "./url-state";

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

export interface CursorPagingState {
  readonly currentPage: number;
  readonly cursor?: string;
  readonly previous: Record<number, string | undefined>;
}

interface CursorPagingInitialState {
  readonly currentPage?: number;
  readonly cursor?: string;
  readonly previous?: Record<number, string | undefined>;
}

export function buildQuery(
  path: string,
  params: Record<string, QueryValue>
): string {
  const query = new URLSearchParams();
  const entries = Object.entries(params).sort(([leftKey], [rightKey]) => {
    const leftIndex = QueryParamOrder.indexOf(leftKey);
    const rightIndex = QueryParamOrder.indexOf(rightKey);

    if (leftIndex === -1 && rightIndex === -1)
      return leftKey.localeCompare(rightKey);
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

export function useCursorPagingState(
  initialState: CursorPagingInitialState = {}
): {
  readonly currentPage: number;
  readonly cursor?: string;
  readonly cursors?: Cursors;
  readonly getPageStateForChange: (nextPage: number) => CursorPagingState;
  readonly handlePageChange: (nextPage: number) => void;
  readonly previous: Record<number, string | undefined>;
  readonly resetPaging: () => void;
  readonly setCursors: React.Dispatch<
    React.SetStateAction<Cursors | undefined>
  >;
  readonly setPagingState: (nextState: CursorPagingInitialState) => void;
} {
  const [currentPage, setCurrentPage] = React.useState(
    initialState.currentPage ?? 0
  );
  const [cursor, setCursor] = React.useState<string | undefined>(
    initialState.cursor
  );
  const [cursors, setCursors] = React.useState<Cursors | undefined>();
  const [previous, setPrevious] = React.useState<
    Record<number, string | undefined>
  >(initialState.previous ?? {});

  const resetPaging = React.useCallback(() => {
    setCurrentPage(0);
    setCursor(undefined);
    setCursors(undefined);
    setPrevious({});
  }, []);

  const setPagingState = React.useCallback(
    (nextState: CursorPagingInitialState) => {
      setCurrentPage(nextState.currentPage ?? 0);
      setCursor(nextState.cursor);
      setPrevious(nextState.previous ?? {});
      setCursors(undefined);
    },
    []
  );

  const getPageStateForChange = React.useCallback(
    (nextPage: number): CursorPagingState => {
      if (currentPage < nextPage) {
        return {
          currentPage: nextPage,
          cursor: cursors?.next,
          previous: {
            ...previous,
            [nextPage - 1]: cursors?.self,
          },
        };
      } else if (currentPage > nextPage) {
        return {
          currentPage: nextPage,
          cursor: previous[nextPage],
          previous,
        };
      }

      return { currentPage, cursor, previous };
    },
    [currentPage, cursor, cursors, previous]
  );

  const handlePageChange = React.useCallback(
    (nextPage: number) => {
      const nextState = getPageStateForChange(nextPage);
      setCurrentPage(nextState.currentPage);
      setCursor(nextState.cursor);
      setPrevious(nextState.previous);
    },
    [getPageStateForChange]
  );

  return {
    currentPage,
    cursor,
    cursors,
    getPageStateForChange,
    handlePageChange,
    previous,
    resetPaging,
    setCursors,
    setPagingState,
  };
}

export function cursorPagingStateFromQuery(
  query: Record<string, string | string[] | undefined>,
  prefix: string
): CursorPagingInitialState {
  return {
    currentPage: parsePositiveInteger(queryParamValue(query[`${prefix}Page`])),
    cursor: queryParamValue(query[`${prefix}Cursor`]),
    previous: decodePreviousCursors(
      queryParamValue(query[`${prefix}PreviousCursors`])
    ),
  };
}

export function cursorPagingStateToQuery(
  prefix: string,
  state?: CursorPagingInitialState
): Record<string, string | undefined> {
  return {
    [`${prefix}Page`]:
      state?.currentPage != null && state.currentPage > 0
        ? state.currentPage.toString()
        : undefined,
    [`${prefix}Cursor`]: state?.cursor,
    [`${prefix}PreviousCursors`]: encodePreviousCursors(state?.previous),
  };
}

function parsePositiveInteger(value?: string): number | undefined {
  if (value == null || !/^\d+$/.test(value)) return undefined;

  const parsed = Number.parseInt(value, 10);
  return parsed > 0 ? parsed : undefined;
}

function decodePreviousCursors(
  value?: string
): Record<number, string | undefined> | undefined {
  if (value == null) return undefined;

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return Object.entries(parsed).reduce<Record<number, string | undefined>>(
      (acc, [key, cursor]) => {
        if (/^\d+$/.test(key) && typeof cursor === "string") {
          acc[Number.parseInt(key, 10)] = cursor;
        }
        return acc;
      },
      {}
    );
  } catch {
    return undefined;
  }
}

function encodePreviousCursors(
  previous?: Record<number, string | undefined>
): string | undefined {
  if (previous == null) return undefined;

  const entries = Object.entries(previous).filter(
    ([, cursor]) => cursor != null
  );
  return entries.length === 0
    ? undefined
    : JSON.stringify(Object.fromEntries(entries));
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
