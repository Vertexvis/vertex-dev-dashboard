import { render, screen, waitFor } from "@testing-library/react";
import React from "react";

import { MetadataStatus } from "../../../components/viewer/MetadataProperties";
import { RightDrawer } from "../../../components/viewer/RightDrawer";
import { Metadata } from "../../../lib/metadata";
import { ModelViewsState } from "../../../lib/model-views";
import { loadItemMetadata } from "../../../pages/scene-viewer/[sceneId]";

type Controller = Parameters<typeof loadItemMetadata>[0]["controller"];

const emptyModelViews: ModelViewsState = {
  modelViewList: [],
  annotationList: [],
  actions: {
    fetchNextModelViews: jest.fn(),
    loadModelView: jest.fn(),
    unloadModelView: jest.fn(),
    fetchNextAnnotations: jest.fn(),
  },
};

function renderProperties(props: {
  metadata?: Metadata;
  metadataStatus?: "loading" | "error" | "ready";
  metadataError?: string;
  metadataDiagnostic?: string;
}) {
  return render(
    <RightDrawer
      active="properties"
      modelViews={emptyModelViews}
      onViewStateSelected={jest.fn()}
      {...props}
    />
  );
}

describe("MetadataProperties (via RightDrawer)", () => {
  it("shows a loading state while metadata is being fetched", () => {
    renderProperties({ metadataStatus: "loading" });

    expect(screen.getByText("Loading metadata...")).toBeInTheDocument();
  });

  it("shows an error state when metadata loading fails", () => {
    renderProperties({
      metadataStatus: "error",
      metadataError: "Unable to load metadata for this item.",
    });

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Unable to load metadata for this item.");
  });

  it("renders returned property keys verbatim (case-sensitive)", () => {
    renderProperties({
      metadataStatus: "ready",
      metadata: {
        partName: "Bracket",
        properties: { Material: "Steel", material: "aluminum" },
      },
    });

    expect(screen.getByText("Material")).toBeInTheDocument();
    expect(screen.getByText("material")).toBeInTheDocument();
    expect(screen.getByText("Steel")).toBeInTheDocument();
    expect(screen.getByText("aluminum")).toBeInTheDocument();
  });

  it("renders exactly the keys the backend-filtered stream contains", () => {
    // Enforcement is backend; this asserts faithful reflection. The unfiltered
    // metadata shows "Cost"; the policy-filtered metadata (same set minus
    // "Cost") does not — the panel never injects excluded keys.
    const { rerender } = renderProperties({
      metadataStatus: "ready",
      metadata: {
        partName: "Bracket",
        properties: { Material: "Steel", Cost: "100" },
      },
    });

    expect(screen.getByText("Material")).toBeInTheDocument();
    expect(screen.getByText("Cost")).toBeInTheDocument();

    rerender(
      <RightDrawer
        active="properties"
        modelViews={emptyModelViews}
        onViewStateSelected={jest.fn()}
        metadataStatus="ready"
        metadata={{ partName: "Bracket", properties: { Material: "Steel" } }}
      />
    );

    expect(screen.getByText("Material")).toBeInTheDocument();
    expect(screen.queryByText("Cost")).not.toBeInTheDocument();
  });

  it("shows the No data state when there are no properties", () => {
    renderProperties({
      metadataStatus: "ready",
      metadata: { partName: "", properties: {} },
    });

    expect(screen.getByText("No data")).toBeInTheDocument();
  });

  it("surfaces a subtle diagnostic when provided", () => {
    renderProperties({
      metadataStatus: "ready",
      metadata: { partName: "", properties: { Material: "Steel" } },
      metadataDiagnostic: "Policy applied, but no metadata was returned.",
    });

    expect(
      screen.getByText("Policy applied, but no metadata was returned.")
    ).toBeInTheDocument();
  });
});

// Minimal harness wiring the real metadata-loading path (via loadItemMetadata)
// to the visible panel, so a rejected Web SDK call actually drives the error UI
// rather than only asserting the helper rejects.
function MetadataLoadingHarness({
  controller,
}: {
  controller: Controller;
}): JSX.Element {
  const [status, setStatus] = React.useState<MetadataStatus>("loading");
  const [error, setError] = React.useState<string>();

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await loadItemMetadata({
          controller,
          itemId: "item-1",
          viewId: "view-1",
        });
        if (!cancelled) setStatus("ready");
      } catch {
        if (cancelled) return;
        setStatus("error");
        setError("Unable to load metadata for this item.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [controller]);

  return (
    <RightDrawer
      active="properties"
      modelViews={emptyModelViews}
      onViewStateSelected={jest.fn()}
      metadataStatus={status}
      metadataError={error}
    />
  );
}

describe("MetadataProperties error path (Web SDK failure)", () => {
  it("shows the error alert when listSceneItemMetadata rejects", async () => {
    const controller = {
      listSceneItemMetadata: jest
        .fn()
        .mockRejectedValue(new Error("metadata unavailable")),
      getSceneViewItem: jest.fn(),
    } as unknown as Controller;

    render(<MetadataLoadingHarness controller={controller} />);

    const alert = await waitFor(() => screen.getByRole("alert"));
    expect(alert).toHaveTextContent("Unable to load metadata for this item.");
  });
});
