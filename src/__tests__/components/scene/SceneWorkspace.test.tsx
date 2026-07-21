import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import React from "react";

import { installJsdomMockServer } from "../../../../test/msw/installJsdomMockServer";
import { server } from "../../../../test/msw/server";
import { renderWithSWR } from "../../../../test/render/renderWithSWR";
import { SceneWorkspace } from "../../../components/scene/SceneWorkspace";

describe("SceneWorkspace", () => {
  installJsdomMockServer();

  it("loads scene-scoped assembly and views without mislabeling saved states", async () => {
    const requests: string[] = [];
    server.use(
      http.get("*/api/scenes/scene-1", ({ request }) => {
        requests.push(request.url);
        return HttpResponse.json({
          attributes: {
            name: "Fixture scene",
            sceneItemCount: 1,
            state: "committed",
            suppliedId: "fixture-scene",
          },
          id: "scene-1",
          type: "scene",
        });
      }),
      http.get("*/api/scene-workspace-items", ({ request }) => {
        requests.push(request.url);
        return HttpResponse.json({
          cursors: {},
          data: [
            {
              attributes: { name: "Assembly item", suppliedId: "item-1" },
              id: "item-1",
              type: "scene-item",
            },
          ],
          status: 200,
        });
      }),
      http.get("*/api/scene-workspace-views", ({ request }) => {
        requests.push(request.url);
        return HttpResponse.json({
          cursors: {},
          data: [
            {
              attributes: { created: "2026-07-21T12:00:00Z" },
              id: "view-1",
              type: "scene-view",
            },
          ],
          status: 200,
        });
      })
    );

    renderWithSWR(<SceneWorkspace sceneId="scene-1" />);

    expect(await screen.findByText("Fixture scene")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Back to scenes" })
    ).toHaveAttribute("href", "/");
    await userEvent.click(screen.getByRole("tab", { name: "Assembly" }));
    expect(await screen.findByText("Assembly item")).toBeVisible();

    await userEvent.click(screen.getByRole("tab", { name: "Views & states" }));
    await userEvent.click(await screen.findByText("view-1"));
    expect(await screen.findByText("Scene saved states")).toBeVisible();
    expect(
      screen.getByText(
        /Vertex lists saved states for a scene, not for a selected scene view\./
      )
    ).toBeVisible();

    await waitFor(() => {
      expect(requests.some((request) => request.includes("stream-key"))).toBe(
        false
      );
      expect(
        requests.some((request) => request.includes("scene-view-states"))
      ).toBe(false);
    });
  });
});
