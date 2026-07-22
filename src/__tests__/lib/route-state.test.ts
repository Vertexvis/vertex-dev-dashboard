import { renderHook } from "@testing-library/react";
import { NextRouter } from "next/router";

import {
  decodeRouteState,
  defineRouteState,
  encodeRouteState,
  navigateToRouteState,
  path,
  query,
  useRouteState,
} from "../../lib/route-state";

const mockRouter = {
  pathname: "/collections/[collectionId]",
  push: jest.fn().mockResolvedValue(true),
  query: {} as Record<string, string | string[] | undefined>,
  replace: jest.fn().mockResolvedValue(true),
};

jest.mock("next/router", () => ({
  useRouter: () => mockRouter,
}));

const definition = defineRouteState({
  collectionId: path.string("collectionId"),
  filters: {
    name: query.string("name"),
  },
  page: query.integer("page", { defaultValue: 0 }),
  sort: query.custom("sort", {
    parse: (value) => (value === "name" ? "name" : "created"),
    serialize: (value) => (value === "created" ? undefined : value),
  }),
});

describe("route-state", () => {
  beforeEach(() => {
    mockRouter.push.mockClear();
    mockRouter.query = {};
    mockRouter.replace.mockClear();
  });

  it("decodes a nested state object from path and query parameters", () => {
    expect(
      decodeRouteState(definition, {
        collectionId: "collection-1",
        name: ["alpha", "ignored"],
        page: "2",
        sort: "name",
      })
    ).toEqual({
      collectionId: "collection-1",
      filters: { name: "alpha" },
      page: 2,
      sort: "name",
    });
  });

  it("uses defaults for missing or malformed parameters", () => {
    expect(
      decodeRouteState(definition, {
        collectionId: "collection-1",
        page: "not-a-page",
        sort: "unsupported",
      })
    ).toEqual({
      collectionId: "collection-1",
      filters: { name: undefined },
      page: 0,
      sort: "created",
    });
  });

  it("encodes the full state atomically while preserving unknown values", () => {
    expect(
      encodeRouteState(
        definition,
        {
          collectionId: "collection-2",
          filters: { name: undefined },
          page: 0,
          sort: "created",
        },
        {
          collectionId: "collection-1",
          name: "old-name",
          page: "3",
          untouched: "keep-me",
        }
      )
    ).toEqual({
      collectionId: "collection-2",
      untouched: "keep-me",
    });
  });

  it("uses the requested browser history method", async () => {
    const push = jest.fn().mockResolvedValue(true);
    const replace = jest.fn().mockResolvedValue(true);
    const router = {
      pathname: "/collections/[collectionId]",
      push,
      query: { collectionId: "collection-1", untouched: "keep-me" },
      replace,
    } as unknown as NextRouter;
    const state = decodeRouteState(definition, router.query);

    await navigateToRouteState(
      router,
      definition,
      { ...state, filters: { name: "alpha" } },
      { history: "push" }
    );

    expect(push).toHaveBeenCalledWith(
      {
        pathname: "/collections/[collectionId]",
        query: {
          collectionId: "collection-1",
          name: "alpha",
          untouched: "keep-me",
        },
      },
      undefined,
      { scroll: false, shallow: true }
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it("returns new URL state when browser navigation changes the query", () => {
    mockRouter.query = {
      collectionId: "collection-1",
      name: "alpha",
      page: "2",
    };
    const { result, rerender } = renderHook(() => useRouteState(definition));

    expect(result.current[0]).toMatchObject({
      filters: { name: "alpha" },
      page: 2,
    });

    mockRouter.query = {
      collectionId: "collection-1",
      name: "beta",
      page: "1",
    };
    rerender();

    expect(result.current[0]).toMatchObject({
      filters: { name: "beta" },
      page: 1,
    });
  });
});
