import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import React from "react";

import { installJsdomMockServer } from "../../../../test/msw/installJsdomMockServer";
import { server } from "../../../../test/msw/server";
import { renderWithSWR } from "../../../../test/render/renderWithSWR";
import { SceneWorkspaceViewer } from "../../../components/scene/SceneWorkspaceViewer";

jest.mock("../../../lib/viewer", () => ({
  useViewer: () => ({ isReady: true, ref: { current: null } }),
}));

jest.mock("@vertexvis/viewer-react", () => {
  const MockReact = jest.requireActual<typeof import("react")>("react");
  return {
    VertexViewer: MockReact.forwardRef(function MockVertexViewer(
      { id }: { readonly id: string },
      ref: React.Ref<HTMLDivElement>
    ) {
      return <div data-testid="vertex-viewer" id={id} ref={ref} />;
    }),
  };
});

describe("SceneWorkspaceViewer", () => {
  installJsdomMockServer();

  it("creates an authenticated in-memory preview without adding a key to the URL", async () => {
    const requests: string[] = [];
    server.use(
      http.post("*/api/stream-keys", async ({ request }) => {
        requests.push(request.url);
        expect(await request.json()).toEqual({ id: "scene-1" });
        return HttpResponse.json({ key: "stream-secret", status: 200 });
      })
    );

    renderWithSWR(
      <SceneWorkspaceViewer
        clientId="client-1"
        sceneId="scene-1"
        vertexEnv="platdev"
      />
    );

    expect(await screen.findByTestId("vertex-viewer")).toHaveAttribute(
      "id",
      "scene-workspace-viewer-scene-1"
    );
    expect(screen.getByTestId("scene-preview-frame")).toHaveAttribute(
      "aria-label",
      "Scene preview viewer"
    );
    expect(requests).toHaveLength(1);
    expect(window.location.href).not.toContain("stream-secret");
    expect(document.body).not.toHaveTextContent("stream-secret");
  });

  it("keeps workspace content available when preview permission is denied", async () => {
    server.use(
      http.post("*/api/stream-keys", () =>
        HttpResponse.json(
          { message: "Forbidden", status: 403 },
          { status: 403 }
        )
      )
    );

    renderWithSWR(
      <SceneWorkspaceViewer
        clientId="client-1"
        sceneId="scene-1"
        vertexEnv="platdev"
      />
    );

    expect(
      await screen.findByText(
        "Viewer preview is unavailable for this account. Workspace details remain available."
      )
    ).toBeVisible();
  });
});
