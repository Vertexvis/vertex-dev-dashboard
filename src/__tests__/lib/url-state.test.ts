import { NextRouter } from "next/router";

import { queryParamValue, updateRouterQuery } from "../../lib/url-state";

describe("url-state", () => {
  it("reads the first value from a Next query param", () => {
    expect(queryParamValue("file-1")).toBe("file-1");
    expect(queryParamValue(["file-1", "file-2"])).toBe("file-1");
    expect(queryParamValue(undefined)).toBeUndefined();
  });

  it("updates query params while preserving the rest of the URL state", async () => {
    const push = jest.fn().mockResolvedValue(true);
    const replace = jest.fn().mockResolvedValue(true);
    const router = {
      pathname: "/file-collections/[fileCollectionId]",
      push,
      query: {
        fileCollectionId: "collection-1",
        page: "2",
      },
      replace,
    } as unknown as NextRouter;

    await updateRouterQuery(router, { fileId: "file-1" });

    expect(push).toHaveBeenCalledWith(
      {
        pathname: "/file-collections/[fileCollectionId]",
        query: {
          fileCollectionId: "collection-1",
          fileId: "file-1",
          page: "2",
        },
      },
      undefined,
      {
        scroll: false,
        shallow: true,
      }
    );

    await updateRouterQuery(router, { fileId: undefined }, "replace");

    expect(replace).toHaveBeenCalledWith(
      {
        pathname: "/file-collections/[fileCollectionId]",
        query: {
          fileCollectionId: "collection-1",
          page: "2",
        },
      },
      undefined,
      {
        scroll: false,
        shallow: true,
      }
    );
  });
});
