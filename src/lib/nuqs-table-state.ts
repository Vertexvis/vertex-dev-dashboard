import { Cursors } from "@vertexvis/api-client-node";
import { createParser, parseAsInteger } from "nuqs";
import React from "react";

import { SortState, toSortParam } from "./sorting";

/** Page index must be a non-negative integer; anything else falls back. */
export const parseAsPageIndex = createParser<number>({
  parse: (value) => {
    const parsed = parseAsInteger.parse(value);
    return parsed == null || parsed < 0 ? null : parsed;
  },
  serialize: (value) => parseAsInteger.serialize(value),
});

/**
 * Sort is stored in the URL as the API sort parameter, e.g. `-created`.
 * Unknown values parse to `null`, which nuqs replaces with the default.
 */
export function makeSortParser(
  values: Record<string, SortState>
): ReturnType<typeof createParser<SortState>> {
  return createParser<SortState>({
    eq: (a, b) => a.field === b.field && a.order === b.order,
    parse: (value) => values[value] ?? null,
    serialize: toSortParam,
  });
}

export interface CursorPagingPatch {
  readonly cursor: string | null;
  readonly page: number;
}

interface UseUrlCursorPagingProps {
  /** Cursor currently stored in the URL. */
  readonly cursor: string | null;
  /** Cursors returned with the currently loaded page, if any. */
  readonly cursors?: Cursors;
  /** Whether a page of results has loaded. */
  readonly loaded: boolean;
  /** Page index currently stored in the URL. */
  readonly page: number;
  /** Key derived from filter and sort state; a change resets the cache. */
  readonly searchKey: string;
  readonly setPaging: (patch: CursorPagingPatch) => void;
}

interface UseUrlCursorPaging {
  readonly handleChangePage: (
    event: React.MouseEvent<HTMLButtonElement> | null,
    num: number
  ) => void;
  readonly nextDisabled: boolean;
  readonly paginationCursors?: Cursors;
  readonly previousDisabled: boolean;
  readonly resetPagingCache: () => void;
}

/**
 * Cursor-based paging on top of URL state. The URL stores the cursor and
 * page index; previous-page cursors are ephemeral server tokens that only
 * live in session state, so the previous button is disabled on a fresh
 * deep link until the user pages forward again.
 */
export function useUrlCursorPaging({
  cursor,
  cursors,
  loaded,
  page,
  searchKey,
  setPaging,
}: UseUrlCursorPagingProps): UseUrlCursorPaging {
  const [cachedCursors, setCachedCursors] = React.useState<Cursors>();
  const [previousCursors, setPreviousCursors] = React.useState<
    Record<number, string | undefined>
  >({});

  const paginationCursors = cursors ?? cachedCursors;

  const resetPagingCache = React.useCallback(() => {
    setCachedCursors(undefined);
    setPreviousCursors({});
  }, []);

  const previousSearchKey = React.useRef(searchKey);
  React.useEffect(() => {
    if (previousSearchKey.current !== searchKey) {
      previousSearchKey.current = searchKey;
      resetPagingCache();
    }
  }, [searchKey, resetPagingCache]);

  React.useEffect(() => {
    if (loaded) setCachedCursors(cursors);
  }, [cursors, loaded]);

  function handleChangePage(
    _: React.MouseEvent<HTMLButtonElement> | null,
    num: number
  ) {
    let nextCursor = cursor;
    if (page < num) {
      nextCursor = paginationCursors?.next ?? null;
      setPreviousCursors((current) => ({
        ...current,
        [page]: paginationCursors?.self,
      }));
    } else if (page > num) {
      nextCursor = previousCursors[num] ?? null;
    }

    setPaging({ cursor: nextCursor, page: num });
  }

  return {
    handleChangePage,
    nextDisabled: paginationCursors?.next == null,
    paginationCursors,
    previousDisabled: page === 0 || previousCursors[page - 1] == null,
    resetPagingCache,
  };
}
