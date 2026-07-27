import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PropertyKeyPolicyMode } from "@vertexvis/api-client-node";
import { http, HttpResponse } from "msw";
import React from "react";

import {
  propertyKeyPoliciesPage,
  propertyKeyPolicy,
} from "../../../../test/msw/handlers/property-key-policies";
import { installJsdomMockServer } from "../../../../test/msw/installJsdomMockServer";
import { server } from "../../../../test/msw/server";
import { renderWithSWR } from "../../../../test/render/renderWithSWR";
import PropertyKeyPolicyTable from "../../../components/property-key-policy/PropertyKeyPolicyTable";

const firstPage = propertyKeyPoliciesPage({
  data: [
    propertyKeyPolicy({
      id: "policy-1",
      mode: PropertyKeyPolicyMode.Allowlist,
      name: "Policy One",
      suppliedId: "supplied-1",
    }),
  ],
});

const filteredPage = propertyKeyPoliciesPage({
  cursors: { self: "page-2" },
  data: [
    propertyKeyPolicy({
      id: "policy-2",
      mode: PropertyKeyPolicyMode.Denylist,
      name: "Policy Two",
      suppliedId: "supplied-2",
    }),
  ],
});

describe("PropertyKeyPolicyTable", () => {
  installJsdomMockServer();

  it("renders policies and maps the mode to Allow/Deny", async () => {
    server.use(
      http.get("*/api/property-key-policies", () =>
        HttpResponse.json(
          propertyKeyPoliciesPage({
            data: [
              propertyKeyPolicy({
                id: "policy-1",
                mode: PropertyKeyPolicyMode.Allowlist,
                name: "Allow Policy",
              }),
              propertyKeyPolicy({
                id: "policy-2",
                mode: PropertyKeyPolicyMode.Denylist,
                name: "Deny Policy",
              }),
            ],
          })
        )
      )
    );

    renderTable();

    expect(await screen.findByText("Allow Policy")).toBeInTheDocument();
    expect(screen.getByText("Deny Policy")).toBeInTheDocument();
    expect(screen.getByText("Allow")).toBeInTheDocument();
    expect(screen.getByText("Deny")).toBeInTheDocument();
  });

  it("links the policy name to the detail route", async () => {
    server.use(
      http.get("*/api/property-key-policies", () =>
        HttpResponse.json(firstPage)
      )
    );

    renderTable();

    expect(await screen.findByText("Policy One")).toBeInTheDocument();
    expect(screen.getByLabelText("Open Policy One")).toHaveAttribute(
      "href",
      "/property-key-policies/policy-1"
    );
  });

  it("filters policies by supplied ID", async () => {
    const requests: string[] = [];

    server.use(
      http.get("*/api/property-key-policies", ({ request }) => {
        const url = new URL(request.url);
        requests.push(url.search);

        return HttpResponse.json(
          url.searchParams.get("suppliedId") === "supplied-2"
            ? filteredPage
            : firstPage
        );
      })
    );

    renderTable();

    expect(await screen.findByText("Policy One")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Supplied ID"), "supplied-2");

    expect(await screen.findByText("Policy Two")).toBeInTheDocument();
    expect(screen.queryByText("Policy One")).not.toBeInTheDocument();
    expect(
      requests.some(
        (search) =>
          new URLSearchParams(search).get("suppliedId") === "supplied-2"
      )
    ).toBe(true);
  });

  it("requires confirmation before deleting and clears the selection on success", async () => {
    const deletedIds: string[][] = [];

    server.use(
      http.get("*/api/property-key-policies", () =>
        HttpResponse.json(firstPage)
      ),
      http.delete("*/api/property-key-policies", async ({ request }) => {
        const body = (await request.json()) as { ids?: string[] };
        deletedIds.push(body.ids ?? []);
        return HttpResponse.json({ status: 200 });
      })
    );

    renderTable();

    expect(await screen.findByText("Policy One")).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("Select Policy One"));
    await userEvent.click(screen.getByLabelText("Delete"));

    // The confirmation dialog is open but no DELETE has fired yet.
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("heading", {
        name: "Delete Property Key Policies",
      })
    ).toBeInTheDocument();
    expect(deletedIds).toEqual([]);

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Delete" })
    );

    await waitFor(() => {
      expect(deletedIds).toEqual([["policy-1"]]);
    });
    expect(screen.queryByText("1 selected")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Select Policy One")).not.toBeChecked();
  });

  it("shows an error when deleting fails after confirmation", async () => {
    const deletedIds: string[][] = [];

    server.use(
      http.get("*/api/property-key-policies", () =>
        HttpResponse.json(firstPage)
      ),
      http.delete("*/api/property-key-policies", async ({ request }) => {
        const body = (await request.json()) as { ids?: string[] };
        deletedIds.push(body.ids ?? []);
        return HttpResponse.json(
          { message: "Could not delete policy-1.", status: 500 },
          { status: 500 }
        );
      })
    );

    renderTable();

    expect(await screen.findByText("Policy One")).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("Select Policy One"));
    await userEvent.click(screen.getByLabelText("Delete"));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Delete" })
    );

    expect(
      await screen.findByText("Could not delete policy-1.")
    ).toBeInTheDocument();
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(screen.getByLabelText("Select Policy One")).toBeChecked();
    expect(deletedIds).toEqual([["policy-1"]]);
  });
});

function renderTable(): void {
  renderWithSWR(<PropertyKeyPolicyTable />);
}
