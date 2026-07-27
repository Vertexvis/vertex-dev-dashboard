import { screen, waitFor } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import React from "react";

import { installJsdomMockServer } from "../../../../test/msw/installJsdomMockServer";
import { server } from "../../../../test/msw/server";
import { renderWithSWR } from "../../../../test/render/renderWithSWR";
import { PolicyChip } from "../../../components/viewer/PolicyChip";

const policiesPage = {
  cursors: { self: "page-1" },
  status: 200,
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
        name: "My Denylist",
        mode: "denylist",
        suppliedId: "deny-1",
      },
    },
  ],
};

describe("PolicyChip", () => {
  installJsdomMockServer();

  it("renders the policy name and Allowlist mode", async () => {
    server.use(
      http.get("*/api/property-key-policies", () =>
        HttpResponse.json(policiesPage)
      )
    );

    renderWithSWR(<PolicyChip policyId="policy-1" />);

    await waitFor(() =>
      expect(
        screen.getByText("Policy: My Allowlist (Allowlist)")
      ).toBeInTheDocument()
    );
  });

  it("renders the policy name and Denylist mode", async () => {
    server.use(
      http.get("*/api/property-key-policies", () =>
        HttpResponse.json(policiesPage)
      )
    );

    renderWithSWR(<PolicyChip policyId="policy-2" />);

    await waitFor(() =>
      expect(
        screen.getByText("Policy: My Denylist (Denylist)")
      ).toBeInTheDocument()
    );
  });

  it("renders nothing when no policyId is provided", () => {
    const { container } = renderWithSWR(<PolicyChip />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText(/Policy:/)).not.toBeInTheDocument();
  });

  it("shows the loading text while policies are fetching", async () => {
    server.use(
      http.get("*/api/property-key-policies", async () => {
        await delay("infinite");
        return HttpResponse.json(policiesPage);
      })
    );

    renderWithSWR(<PolicyChip policyId="policy-1" />);

    expect(
      await screen.findByText("Policy: Loading policy...")
    ).toBeInTheDocument();
  });
});
