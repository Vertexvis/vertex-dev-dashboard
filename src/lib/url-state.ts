import { NextRouter } from "next/router";

export type QueryParamValue = string | string[] | undefined;

export function queryParamValue(value: QueryParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function updateRouterQuery(
  router: NextRouter,
  updates: Record<string, string | undefined>,
  method: "push" | "replace" = "push"
): Promise<boolean> {
  const query = { ...router.query };

  for (const [key, value] of Object.entries(updates)) {
    if (value == null || value === "") delete query[key];
    else query[key] = value;
  }

  const navigate = method === "replace" ? router.replace : router.push;
  return navigate.call(
    router,
    { pathname: router.pathname, query },
    undefined,
    {
      scroll: false,
      shallow: true,
    }
  );
}
