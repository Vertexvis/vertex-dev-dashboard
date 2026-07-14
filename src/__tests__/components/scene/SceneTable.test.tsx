import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { rest } from "msw";
import nodeFetch, { Headers, Request, Response } from "node-fetch";
import React from "react";
import { SWRConfig } from "swr";

import { server } from "../../../../test/msw/server";
import SceneTable from "../../../components/scene/SceneTable";
import { Scene } from "../../../lib/scenes";

// todo:PLAT-8812
const mockPush = jest.fn();

jest.mock("next/router", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

const scene: Scene = {
  id: "scene-1",
  created: "2026-07-01T15:30:00Z",
  name: "Scene One",
  state: "ready",
  suppliedId: "supplied-scene-1",
};

const secondScene: Scene = {
  id: "scene-2",
  created: "2026-07-02T15:30:00Z",
  name: "Scene Two",
  state: "ready",
  suppliedId: "supplied-scene-2",
};

const page = {
  cursors: { self: "page-1" },
  data: [
    {
      type: "scene",
      id: scene.id,
      attributes: {
        created: scene.created,
        name: scene.name,
        state: scene.state,
        suppliedId: scene.suppliedId,
      },
    },
    {
      type: "scene",
      id: secondScene.id,
      attributes: {
        created: secondScene.created,
        name: secondScene.name,
        state: secondScene.state,
        suppliedId: secondScene.suppliedId,
      },
    },
  ],
  status: 200,
};

describe("SceneTable", () => {
  beforeAll(() => {
    Object.assign(global, {
      Headers,
      Request,
      Response,
      fetch: nodeFetch,
    });
    server.listen({ onUnhandledRequest: "error" });
  });

  afterEach(() => {
    server.resetHandlers();
    jest.restoreAllMocks();
    mockPush.mockClear();
    Object.assign(global, { fetch: nodeFetch });
  });

  afterAll(() => {
    server.close();
  });

  it("preserves the active scene highlight after the drawer scene clears", async () => {
    server.use(
      rest.get("*/api/scenes", (_req, res, ctx) => {
        return res(ctx.json(page));
      })
    );

    const { rerender } = renderTable(scene);

    await waitFor(() => {
      expect(getSceneRow()).toHaveClass("Mui-selected");
    });

    rerender(renderTableElement(undefined));

    await waitFor(() => {
      expect(getSceneRow()).toHaveClass("Mui-selected");
    });
  });

  it("updates the active highlight immediately when another scene is clicked", async () => {
    server.use(
      rest.get("*/api/scenes", (_req, res, ctx) => {
        return res(ctx.json(page));
      })
    );

    renderTable(scene);

    await waitFor(() => {
      expect(getSceneRow("Scene One")).toHaveClass("Mui-selected");
    });

    await userEvent.click(getSceneRow("Scene Two"));

    await waitFor(() => {
      expect(getSceneRow("Scene Two")).toHaveClass("Mui-selected");
    });
    expect(getSceneRow("Scene One")).not.toHaveClass("Mui-selected");
  });

  it("shows an open hint on the scene name", async () => {
    server.use(
      rest.get("*/api/scenes", (_req, res, ctx) => {
        return res(ctx.json(page));
      })
    );

    renderTable(scene);

    const name = await screen.findByLabelText("Open Scene One");
    await userEvent.hover(name);

    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Open Scene One"
    );
  });

  it("opens the scene viewer when the scene name is clicked", async () => {
    const onClick = jest.fn();
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();

      if (url === "/api/stream-keys") {
        return Promise.resolve({
          json: () => Promise.resolve({ key: "stream-key-1" }),
          ok: true,
        } as Response);
      }

      return (nodeFetch as typeof global.fetch)(
        new URL(url, window.location.origin).toString(),
        init
      );
    }) as typeof global.fetch;

    server.use(
      rest.get("*/api/scenes", (_req, res, ctx) => {
        return res(ctx.json(page));
      })
    );

    renderTable(scene, { onClick });

    await userEvent.click(await screen.findByLabelText("Open Scene One"));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalled();
    });
    expect(onClick).not.toHaveBeenCalled();
  });
});

function getSceneRow(name = "Scene One"): HTMLTableRowElement {
  const row = screen.getByText(name).closest("tr");
  if (row == null) throw new Error("Could not find scene row.");

  return row;
}

function renderTable(
  scene?: Scene,
  props: Partial<React.ComponentProps<typeof SceneTable>> = {}
) {
  return render(renderTableElement(scene, props));
}

function renderTableElement(
  scene?: Scene,
  props: Partial<React.ComponentProps<typeof SceneTable>> = {}
): JSX.Element {
  return (
    <SWRConfig
      value={{
        dedupingInterval: 0,
        fetcher: (url: string) =>
          (global.fetch as typeof nodeFetch)(
            new URL(url, window.location.origin).toString()
          ).then((res) => res.json()),
        provider: () => new Map(),
      }}
    >
      <SceneTable
        clientId="client-id"
        invalidationCount={0}
        onClick={jest.fn()}
        onEditClick={jest.fn()}
        scene={scene}
        vertexEnv="platdev"
        {...props}
      />
    </SWRConfig>
  );
}
