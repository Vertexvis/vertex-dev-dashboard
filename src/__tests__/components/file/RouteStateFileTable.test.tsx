import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import React from "react";

import { installJsdomMockServer } from "../../../../test/msw/installJsdomMockServer";
import { server } from "../../../../test/msw/server";
import { renderWithSWR } from "../../../../test/render/renderWithSWR";
import RouteStateFileTable from "../../../components/file/RouteStateFileTable";
import { FileTableRouteState } from "../../../lib/files-route-state";
import { SetRouteState } from "../../../lib/route-state";

jest.mock("next/router", () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

const page = {
  cursors: { self: "page-1" },
  data: [
    {
      type: "file",
      id: "file-1",
      attributes: {
        created: "2026-06-10T15:30:00Z",
        name: "alpha.jt",
        status: "complete",
        suppliedId: "supplied-1",
        uploaded: "2026-06-10T15:45:00Z",
      },
    },
  ],
  status: 200,
};

const pagedPage = {
  cursors: { self: "page-1", next: "page-2" },
  data: page.data,
  status: 200,
};

const defaultRouteState: FileTableRouteState = {
  filters: {
    createdAtEnd: undefined,
    createdAtStart: undefined,
    fileId: undefined,
    name: undefined,
    suppliedId: undefined,
  },
  paging: { cursor: undefined, page: 0 },
  sort: { field: "created", order: "desc" },
};

describe("RouteStateFileTable", () => {
  installJsdomMockServer();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("loads transferable table state from one route object", async () => {
    const requests: string[] = [];
    const routeState: FileTableRouteState = {
      filters: {
        createdAtEnd: "2026-06-30",
        createdAtStart: "2026-06-01",
        fileId: "file-filter",
        name: "alpha",
        suppliedId: "supplied-1",
      },
      paging: { cursor: "cursor-2", page: 2 },
      sort: { field: "name", order: "asc" },
    };

    server.use(
      http.get("*/api/files", ({ request }) => {
        requests.push(request.url);
        return HttpResponse.json(page);
      })
    );

    renderTable(routeState);

    expect(await screen.findByText("alpha.jt")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("alpha");
    expect(screen.getByLabelText("File ID")).toHaveValue("file-filter");
    expect(screen.getByLabelText("Supplied ID")).toHaveValue("supplied-1");
    expect(screen.getByLabelText("Created From")).toHaveValue("2026-06-01");
    expect(screen.getByLabelText("Created To")).toHaveValue("2026-06-30");
    expect(screen.getByLabelText("Go to previous page")).toBeDisabled();

    const request = new URL(requests[0]);
    expect(request.searchParams.get("cursor")).toBe("cursor-2");
    expect(request.searchParams.get("fileId")).toBe("file-filter");
    expect(request.searchParams.get("name")).toBe("alpha");
    expect(request.searchParams.get("sort")).toBe("name");
    expect(request.searchParams.get("suppliedId")).toBe("supplied-1");
    expect(request.searchParams.has("createdAtStart")).toBe(true);
    expect(request.searchParams.has("createdAtEnd")).toBe(true);
  });

  it("updates a filter and resets paging as one route-state change", async () => {
    let nextState: FileTableRouteState | undefined;
    const onRouteStateChange: SetRouteState<FileTableRouteState> = jest.fn(
      (update, options) => {
        nextState =
          typeof update === "function" ? update(defaultRouteState) : update;
        expect(options).toEqual({ history: "replace" });
        return Promise.resolve(true);
      }
    );

    server.use(http.get("*/api/files", () => HttpResponse.json(page)));

    renderTable(
      {
        ...defaultRouteState,
        paging: { cursor: "cursor-2", page: 2 },
      },
      onRouteStateChange
    );

    expect(await screen.findByText("alpha.jt")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Name"), "alpha");

    await waitFor(() => expect(onRouteStateChange).toHaveBeenCalledTimes(1));
    expect(nextState).toEqual({
      ...defaultRouteState,
      filters: { ...defaultRouteState.filters, name: "alpha" },
      paging: { cursor: undefined, page: 0 },
    });
  });

  it("moves forward with the API cursor using push history", async () => {
    let nextState: FileTableRouteState | undefined;
    const onRouteStateChange: SetRouteState<FileTableRouteState> = jest.fn(
      (update, options) => {
        nextState =
          typeof update === "function" ? update(defaultRouteState) : update;
        expect(options).toEqual({ history: "push" });
        return Promise.resolve(true);
      }
    );

    server.use(http.get("*/api/files", () => HttpResponse.json(pagedPage)));

    renderTable(defaultRouteState, onRouteStateChange);

    expect(await screen.findByText("alpha.jt")).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("Go to next page"));

    expect(nextState).toEqual({
      ...defaultRouteState,
      paging: { cursor: "page-2", page: 1 },
    });
  });
});

function renderTable(
  routeState: FileTableRouteState,
  onRouteStateChange: SetRouteState<FileTableRouteState> = jest
    .fn()
    .mockResolvedValue(true)
): void {
  renderWithSWR(
    <RouteStateFileTable
      onFileSelected={jest.fn()}
      onRouteStateChange={onRouteStateChange}
      routeState={routeState}
    />
  );
}
