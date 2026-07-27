import { render, screen, waitFor, within } from "@testing-library/react";
import React from "react";

import { MetadataStatus } from "../../../components/viewer/MetadataStates";
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

function renderCompare(props: {
  metadata?: Metadata;
  streamMetadata?: Metadata;
  metadataStatus?: MetadataStatus;
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

// Return the table row (<tr>) that contains the given key text.
function rowForKey(key: string): HTMLElement {
  const cell = screen.getByText(key).closest("tr");
  if (cell == null) throw new Error(`No row found for key ${key}`);
  return cell as HTMLElement;
}

describe("MetadataCompare (via RightDrawer)", () => {
  const query: Metadata = {
    partName: "Bracket",
    properties: { Material: "Steel", Cost: "100" },
  };

  it("shows matching keys with equal values as non-diff and does not flag them", () => {
    renderCompare({
      metadataStatus: "ready",
      metadata: { partName: "Bracket", properties: { Material: "Steel" } },
      streamMetadata: {
        partName: "Bracket",
        properties: { Material: "Steel" },
      },
    });

    const row = rowForKey("Material");
    expect(row).toHaveAttribute("data-state", "match");
    expect(within(row).queryByText("Differs")).not.toBeInTheDocument();
    expect(screen.getByText("0 differences")).toBeInTheDocument();
  });

  it("flags a key present only in query as query-only", () => {
    renderCompare({
      metadataStatus: "ready",
      metadata: { partName: "", properties: { Material: "Steel" } },
      streamMetadata: { partName: "", properties: {} },
    });

    const row = rowForKey("Material");
    expect(row).toHaveAttribute("data-state", "query-only");
    expect(within(row).getByText("Query only")).toBeInTheDocument();
    // Stream value shown as the em-dash placeholder.
    expect(within(row).getByText("Steel")).toBeInTheDocument();
    expect(screen.getByText("1 difference")).toBeInTheDocument();
  });

  it("flags a key present only in stream as stream-only", () => {
    renderCompare({
      metadataStatus: "ready",
      metadata: { partName: "", properties: {} },
      streamMetadata: { partName: "", properties: { Secret: "hidden" } },
    });

    const row = rowForKey("Secret");
    expect(row).toHaveAttribute("data-state", "stream-only");
    expect(within(row).getByText("Stream only")).toBeInTheDocument();
    expect(within(row).getByText("hidden")).toBeInTheDocument();
    expect(screen.getByText("1 difference")).toBeInTheDocument();
  });

  it("flags differing values as diff and counts every highlighted row", () => {
    renderCompare({
      metadataStatus: "ready",
      metadata: {
        partName: "",
        properties: { Material: "Steel", Weight: "12kg", OnlyQuery: "q" },
      },
      streamMetadata: {
        partName: "",
        properties: { Material: "Aluminum", Weight: "12kg", OnlyStream: "s" },
      },
    });

    // Material differs.
    const material = rowForKey("Material");
    expect(material).toHaveAttribute("data-state", "diff");
    expect(within(material).getByText("Differs")).toBeInTheDocument();

    // Weight is identical -> match.
    expect(rowForKey("Weight")).toHaveAttribute("data-state", "match");

    // Query-only and stream-only rows.
    expect(rowForKey("OnlyQuery")).toHaveAttribute("data-state", "query-only");
    expect(rowForKey("OnlyStream")).toHaveAttribute(
      "data-state",
      "stream-only"
    );

    // diff + query-only + stream-only = 3 highlighted rows.
    expect(screen.getByText("3 differences")).toBeInTheDocument();
  });

  it("keeps case-sensitive keys as distinct rows", () => {
    renderCompare({
      metadataStatus: "ready",
      metadata: {
        partName: "",
        properties: { Material: "Steel", material: "aluminum" },
      },
      streamMetadata: {
        partName: "",
        properties: { Material: "Steel", material: "aluminum" },
      },
    });

    expect(rowForKey("Material")).toHaveAttribute("data-state", "match");
    expect(rowForKey("material")).toHaveAttribute("data-state", "match");
    // Distinct rows: neither folds into the other.
    expect(rowForKey("Material")).not.toBe(rowForKey("material"));
  });

  it("preserves alphabetical key order across both sources", () => {
    renderCompare({
      metadataStatus: "ready",
      metadata: { partName: "", properties: { Zeta: "z", Alpha: "a" } },
      streamMetadata: { partName: "", properties: { Mu: "m" } },
    });

    const keys = screen
      .getAllByRole("row")
      // Skip the header row (has no data-state).
      .filter((r) => r.getAttribute("data-state") != null)
      // The key cell may also contain an accessible state marker; read only the
      // key Typography (rendered with the subtitle2 variant).
      .map(
        (r) =>
          within(r)
            .getAllByRole("cell")[0]
            .querySelector(".MuiTypography-subtitle2")?.textContent
      );

    expect(keys).toEqual(["Alpha", "Mu", "Zeta"]);
  });

  describe("stream metadata unavailable", () => {
    it("renders query rows, shows the click-an-item caption, and flags nothing", () => {
      renderCompare({
        metadataStatus: "ready",
        metadata: query,
        streamMetadata: undefined,
      });

      // Query rows render.
      expect(screen.getByText("Material")).toBeInTheDocument();
      expect(screen.getByText("Cost")).toBeInTheDocument();

      // Nothing is falsely flagged as query-only.
      expect(rowForKey("Material")).toHaveAttribute("data-state", "match");
      expect(rowForKey("Cost")).toHaveAttribute("data-state", "match");
      expect(screen.queryByText("Query only")).not.toBeInTheDocument();

      // Stream column shows the guidance caption, not a difference count.
      expect(
        screen.getByText(
          "Stream metadata appears when you click an item in the viewer."
        )
      ).toBeInTheDocument();
      expect(screen.queryByText(/differences?$/)).not.toBeInTheDocument();
    });
  });

  it("shows a loading state while metadata is being fetched", () => {
    renderCompare({ metadataStatus: "loading" });

    expect(screen.getByText("Loading metadata...")).toBeInTheDocument();
  });

  it("shows an error state (role=alert) when metadata loading fails", () => {
    renderCompare({
      metadataStatus: "error",
      metadataError: "Unable to load metadata for this item.",
    });

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Unable to load metadata for this item.");
  });

  it("shows the No data state when both sources are empty and ready", () => {
    renderCompare({
      metadataStatus: "ready",
      metadata: { partName: "", properties: {} },
      streamMetadata: { partName: "", properties: {} },
    });

    expect(screen.getByText("No data")).toBeInTheDocument();
  });

  it("renders exactly the query keys the backend-filtered stream contains", () => {
    // Enforcement is backend; the panel never injects excluded keys.
    const { rerender } = renderCompare({
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

  it("surfaces a subtle diagnostic without blocking the comparison", () => {
    renderCompare({
      metadataStatus: "ready",
      metadata: { partName: "", properties: { Material: "Steel" } },
      streamMetadata: { partName: "", properties: { Material: "Steel" } },
      metadataDiagnostic: "Policy applied, but no metadata was returned.",
    });

    expect(
      screen.getByText("Policy applied, but no metadata was returned.")
    ).toBeInTheDocument();
    // Comparison still renders alongside the diagnostic.
    expect(rowForKey("Material")).toHaveAttribute("data-state", "match");
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

describe("MetadataCompare error path (Web SDK failure)", () => {
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
