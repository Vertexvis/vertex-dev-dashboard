import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import React from "react";

import { installJsdomMockServer } from "../../../../test/msw/installJsdomMockServer";
import { server } from "../../../../test/msw/server";
import { renderWithSWR } from "../../../../test/render/renderWithSWR";
import SceneTable from "../../../components/scene/SceneTable";
import { Scene } from "../../../lib/scenes";

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRouter = {
  isReady: true,
  pathname: "/",
  push: mockPush,
  query: {} as Record<string, string | string[] | undefined>,
  replace: mockReplace,
};

jest.mock("next/router", () => ({
  useRouter: () => mockRouter,
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

const firstPage = {
  cursors: { self: "scene-page-1", next: "scene-page-2" },
  data: [
    {
      type: "scene",
      id: "scene-1",
      attributes: {
        created: "2026-06-10T15:30:00Z",
        name: "Scene One",
        state: "ready",
        suppliedId: "supplied-1",
      },
    },
  ],
  status: 200,
};

const secondPage = {
  cursors: { self: "scene-page-2" },
  data: [
    {
      type: "scene",
      id: "scene-2",
      attributes: {
        created: "2026-06-11T15:30:00Z",
        name: "Scene Two",
        state: "ready",
        suppliedId: "supplied-2",
      },
    },
  ],
  status: 200,
};

describe("SceneTable", () => {
  installJsdomMockServer();

  afterEach(() => {
    jest.restoreAllMocks();
    mockPush.mockClear();
    mockReplace.mockClear();
    mockRouter.query = {};
  });

  it("preserves the active scene highlight after the drawer scene clears", async () => {
    server.use(
      http.get("*/api/scenes", () => {
        return HttpResponse.json(page);
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
      http.get("*/api/scenes", () => {
        return HttpResponse.json(page);
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
      http.get("*/api/scenes", () => {
        return HttpResponse.json(page);
      })
    );

    renderTable(scene);

    const name = await screen.findByLabelText("Open Scene One");
    await userEvent.hover(name);

    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Open Scene One"
    );
  });

  it("renders a dedicated scene viewer href", async () => {
    const onClick = jest.fn();

    server.use(
      http.get("*/api/scenes", () => {
        return HttpResponse.json(page);
      })
    );

    renderTable(scene, { onClick });

    expect(await screen.findByLabelText("Open Scene One")).toHaveAttribute(
      "href",
      "/scene-viewer/scene-1"
    );
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
  return renderWithSWR(renderTableElement(scene, props));
}

function renderTableElement(
  scene?: Scene,
  props: Partial<React.ComponentProps<typeof SceneTable>> = {}
): JSX.Element {
  return (
    <SceneTable
      invalidationCount={0}
      onClick={jest.fn()}
      onEditClick={jest.fn()}
      scene={scene}
      {...props}
    />
  );
}
