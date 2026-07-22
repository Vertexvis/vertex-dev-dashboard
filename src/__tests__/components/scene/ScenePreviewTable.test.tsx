import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import React from "react";

import { installJsdomMockServer } from "../../../../test/msw/installJsdomMockServer";
import { server } from "../../../../test/msw/server";
import { renderWithSWR } from "../../../../test/render/renderWithSWR";
import { ScenePreviewTable } from "../../../components/scene/ScenePreviewTable";

describe("ScenePreviewTable", () => {
  installJsdomMockServer();

  it("keeps row selection separate from the explicit workspace link", async () => {
    server.use(
      http.get("*/api/scenes", () =>
        HttpResponse.json({
          cursors: {},
          data: [
            {
              attributes: {
                created: "2026-07-21T12:00:00Z",
                name: "Preview scene",
                state: "ready",
                suppliedId: "preview-1",
              },
              id: "scene-1",
              type: "scene",
            },
          ],
          status: 200,
        })
      )
    );

    const onClick = jest.fn();
    renderWithSWR(<ScenePreviewTable onClick={onClick} />);

    expect(
      await screen.findByLabelText("Open workspace for Preview scene")
    ).toHaveAttribute("href", "/scene-workspace/scene-1");
    const row = (await screen.findByText("Preview scene")).closest("tr");
    if (row == null) throw new Error("Preview scene row was not found.");
    await userEvent.click(row);
    expect(onClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: "scene-1", name: "Preview scene" })
    );
  });
});
