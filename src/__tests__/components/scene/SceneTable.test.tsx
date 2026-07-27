import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import React from "react";

import { installJsdomMockServer } from "../../../../test/msw/installJsdomMockServer";
import { server } from "../../../../test/msw/server";
import { renderWithSWR } from "../../../../test/render/renderWithSWR";
import SceneTable from "../../../components/scene/SceneTable";
import { Scene } from "../../../lib/scenes";

const mockPush = jest.fn();

jest.mock("next/router", () => ({
  useRouter: () => ({ push: mockPush }),
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

const emptyPoliciesPage = {
  cursors: { self: "page-1" },
  data: [],
  status: 200,
};

const policiesPage = {
  cursors: { self: "page-1" },
  data: [
    {
      type: "property-key-policy",
      id: "policy-1",
      attributes: {
        createdAt: "2026-06-01T00:00:00Z",
        name: "My Allowlist",
        mode: "allowlist",
        suppliedId: "allow-1",
      },
    },
    {
      type: "property-key-policy",
      id: "policy-2",
      attributes: {
        createdAt: "2026-06-02T00:00:00Z",
        mode: "denylist",
        suppliedId: "deny-supplied",
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
  });

  it("preserves the active scene highlight after the drawer scene clears", async () => {
    server.use(
      http.get("*/api/scenes", () => {
        return HttpResponse.json(page);
      }),
      http.get("*/api/property-key-policies", () => {
        return HttpResponse.json(emptyPoliciesPage);
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
      }),
      http.get("*/api/property-key-policies", () => {
        return HttpResponse.json(emptyPoliciesPage);
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
      }),
      http.get("*/api/property-key-policies", () => {
        return HttpResponse.json(emptyPoliciesPage);
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
      }),
      http.get("*/api/property-key-policies", () => {
        return HttpResponse.json(emptyPoliciesPage);
      })
    );

    renderTable(scene, { onClick });

    expect(await screen.findByLabelText("Open Scene One")).toHaveAttribute(
      "href",
      "/scene-viewer/scene-1"
    );
  });

  it("renders policy options from /api/property-key-policies", async () => {
    server.use(
      http.get("*/api/scenes", () => {
        return HttpResponse.json(page);
      }),
      http.get("*/api/property-key-policies", () => {
        return HttpResponse.json(policiesPage);
      })
    );

    renderTable(scene);

    // The dropdown should be present
    expect(
      await screen.findByLabelText("Property Key Policy")
    ).toBeInTheDocument();

    // Open the dropdown
    await userEvent.click(screen.getByLabelText("Property Key Policy"));

    // Should show the None option and both policy options
    expect(
      await screen.findByRole("option", { name: /None \(unrestricted\)/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /My Allowlist/i })
    ).toBeInTheDocument();
    // Policy 2 falls back to suppliedId since it has no name
    expect(
      screen.getByRole("option", { name: /deny-supplied/i })
    ).toBeInTheDocument();
  });

  it("appends policyId to scene viewer href when a policy is selected", async () => {
    server.use(
      http.get("*/api/scenes", () => {
        return HttpResponse.json(page);
      }),
      http.get("*/api/property-key-policies", () => {
        return HttpResponse.json(policiesPage);
      })
    );

    renderTable(scene);

    await screen.findByLabelText("Open Scene One");

    // Confirm no policyId without selection
    expect(screen.getByLabelText("Open Scene One")).toHaveAttribute(
      "href",
      "/scene-viewer/scene-1"
    );

    // Open dropdown and select policy-1
    await userEvent.click(screen.getByLabelText("Property Key Policy"));
    await userEvent.click(
      await screen.findByRole("option", { name: /My Allowlist/i })
    );

    // Href should now include policyId
    await waitFor(() => {
      expect(screen.getByLabelText("Open Scene One")).toHaveAttribute(
        "href",
        "/scene-viewer/scene-1?policyId=policy-1"
      );
    });
  });

  it("uses policyId in router.push when View scene action is clicked with a policy selected", async () => {
    server.use(
      http.get("*/api/scenes", () => {
        return HttpResponse.json(page);
      }),
      http.get("*/api/property-key-policies", () => {
        return HttpResponse.json(policiesPage);
      })
    );

    renderTable(scene);

    await screen.findByLabelText("Open Scene One");

    // Select policy-1
    await userEvent.click(screen.getByLabelText("Property Key Policy"));
    await userEvent.click(
      await screen.findByRole("option", { name: /My Allowlist/i })
    );

    // Find and click the actions menu for Scene One
    const actionsButton = screen.getByLabelText("Actions for Scene One");
    await userEvent.click(actionsButton);

    const viewSceneItem = await screen.findByRole("menuitem", {
      name: "View scene",
    });
    await userEvent.click(viewSceneItem);

    expect(mockPush).toHaveBeenCalledWith(
      "/scene-viewer/scene-1?policyId=policy-1"
    );
  });

  it("disables the policy control and shows a spinner while policies are loading", async () => {
    server.use(
      http.get("*/api/scenes", () => {
        return HttpResponse.json(page);
      }),
      http.get("*/api/property-key-policies", async () => {
        await delay("infinite");
        return HttpResponse.json(emptyPoliciesPage);
      })
    );

    renderTable(scene);

    await waitFor(() => {
      expect(screen.getByLabelText("Property Key Policy")).toHaveAttribute(
        "aria-disabled",
        "true"
      );
    });

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("disables the policy control and shows an error caption when policies fail to load", async () => {
    server.use(
      http.get("*/api/scenes", () => {
        return HttpResponse.json(page);
      }),
      http.get("*/api/property-key-policies", () => {
        return HttpResponse.error();
      })
    );

    renderTable(scene);

    await waitFor(() => {
      expect(screen.getByText("Could not load policies")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Property Key Policy")).toHaveAttribute(
      "aria-disabled",
      "true"
    );
  });

  it("omits policyId from navigation when None is selected", async () => {
    server.use(
      http.get("*/api/scenes", () => {
        return HttpResponse.json(page);
      }),
      http.get("*/api/property-key-policies", () => {
        return HttpResponse.json(policiesPage);
      })
    );

    renderTable(scene);

    await screen.findByLabelText("Open Scene One");

    // Select a policy first, then switch back to None
    await userEvent.click(screen.getByLabelText("Property Key Policy"));
    await userEvent.click(
      await screen.findByRole("option", { name: /My Allowlist/i })
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Open Scene One")).toHaveAttribute(
        "href",
        "/scene-viewer/scene-1?policyId=policy-1"
      );
    });

    // Select None
    await userEvent.click(screen.getByLabelText("Property Key Policy"));
    await userEvent.click(
      await screen.findByRole("option", { name: /None \(unrestricted\)/i })
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Open Scene One")).toHaveAttribute(
        "href",
        "/scene-viewer/scene-1"
      );
    });
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
