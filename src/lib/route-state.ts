import { NextRouter, useRouter } from "next/router";
import React from "react";

export type RouteParamValue = string | string[] | undefined;
export type RouteStateHistory = "push" | "replace";

export interface RouteStateUpdateOptions {
  readonly history?: RouteStateHistory;
}

interface RouteParam<T> {
  readonly __value?: T;
  readonly kind: "route-param";
  readonly name: string;
  readonly parse: (value: RouteParamValue) => unknown;
  readonly serialize: (value: unknown) => string | undefined;
  readonly source: "path" | "query";
}

export type RouteStateDefinition = {
  readonly [key: string]: RouteParam<unknown> | RouteStateDefinition;
};

export type RouteState<TDefinition extends RouteStateDefinition> = {
  readonly [TKey in keyof TDefinition]: TDefinition[TKey] extends RouteParam<
    infer TValue
  >
    ? TValue
    : TDefinition[TKey] extends RouteStateDefinition
    ? RouteState<TDefinition[TKey]>
    : never;
};

export type SetRouteState<TState> = (
  update: React.SetStateAction<TState>,
  options?: RouteStateUpdateOptions
) => Promise<boolean>;

interface CustomParamOptions<T> {
  readonly parse: (value?: string) => T;
  readonly serialize: (value: T) => string | undefined;
}

interface IntegerParamOptions {
  readonly defaultValue: number;
  readonly minimum?: number;
}

function firstValue(value: RouteParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function param<T>(
  source: "path" | "query",
  name: string,
  options: CustomParamOptions<T>
): RouteParam<T> {
  return {
    kind: "route-param",
    name,
    parse: (value) => options.parse(firstValue(value)),
    serialize: (value) => options.serialize(value as T),
    source,
  };
}

function stringParam(
  source: "path" | "query",
  name: string
): RouteParam<string | undefined> {
  return param(source, name, {
    parse: (value) => (value == null || value === "" ? undefined : value),
    serialize: (value) => value,
  });
}

export const path = {
  string(name: string): RouteParam<string | undefined> {
    return stringParam("path", name);
  },
};

export const query = {
  custom<T>(name: string, options: CustomParamOptions<T>): RouteParam<T> {
    return param("query", name, options);
  },

  integer(name: string, options: IntegerParamOptions): RouteParam<number> {
    const minimum = options.minimum ?? 0;
    return param("query", name, {
      parse: (value) => {
        if (value == null || !/^\d+$/.test(value)) {
          return options.defaultValue;
        }

        const parsed = Number.parseInt(value, 10);
        return parsed >= minimum ? parsed : options.defaultValue;
      },
      serialize: (value) =>
        value === options.defaultValue ? undefined : value.toString(),
    });
  },

  string(name: string): RouteParam<string | undefined> {
    return stringParam("query", name);
  },
};

export function defineRouteState<TDefinition extends RouteStateDefinition>(
  definition: TDefinition
): TDefinition {
  return definition;
}

function isRouteParam(
  value: RouteParam<unknown> | RouteStateDefinition
): value is RouteParam<unknown> {
  return value.kind === "route-param";
}

export function decodeRouteState<TDefinition extends RouteStateDefinition>(
  definition: TDefinition,
  values: Record<string, RouteParamValue>
): RouteState<TDefinition> {
  const state: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(definition)) {
    state[key] = isRouteParam(value)
      ? value.parse(values[value.name])
      : decodeRouteState(value, values);
  }

  return state as RouteState<TDefinition>;
}

export function encodeRouteState<TDefinition extends RouteStateDefinition>(
  definition: TDefinition,
  state: RouteState<TDefinition>,
  currentValues: Record<string, RouteParamValue> = {}
): Record<string, RouteParamValue> {
  const values = { ...currentValues };

  function encodeNode(
    nodeDefinition: RouteStateDefinition,
    nodeState: Record<string, unknown>
  ): void {
    for (const [key, value] of Object.entries(nodeDefinition)) {
      if (isRouteParam(value)) {
        const serialized = value.serialize(nodeState[key]);
        if (serialized == null || serialized === "") {
          delete values[value.name];
        } else {
          values[value.name] = serialized;
        }
      } else {
        encodeNode(value, nodeState[key] as Record<string, unknown>);
      }
    }
  }

  encodeNode(definition, state as Record<string, unknown>);
  return values;
}

export function navigateToRouteState<TDefinition extends RouteStateDefinition>(
  router: NextRouter,
  definition: TDefinition,
  state: RouteState<TDefinition>,
  options: RouteStateUpdateOptions = {}
): Promise<boolean> {
  const history = options.history ?? "replace";
  const navigate = history === "push" ? router.push : router.replace;

  return navigate.call(
    router,
    {
      pathname: router.pathname,
      query: encodeRouteState(definition, state, router.query),
    },
    undefined,
    { scroll: false, shallow: true }
  );
}

export function useRouteState<TDefinition extends RouteStateDefinition>(
  definition: TDefinition
): readonly [RouteState<TDefinition>, SetRouteState<RouteState<TDefinition>>] {
  const router = useRouter();
  const state = React.useMemo(
    () => decodeRouteState(definition, router.query),
    [definition, router.query]
  );

  const setState = React.useCallback<SetRouteState<RouteState<TDefinition>>>(
    (update, options) => {
      const current = decodeRouteState(definition, router.query);
      const next =
        typeof update === "function"
          ? (
              update as (
                value: RouteState<TDefinition>
              ) => RouteState<TDefinition>
            )(current)
          : update;

      return navigateToRouteState(router, definition, next, options);
    },
    [definition, router]
  );

  return [state, setState] as const;
}
