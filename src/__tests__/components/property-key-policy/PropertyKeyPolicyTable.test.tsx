import { screen, waitFor } from "@testing-library/react";
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
          }),
        ),
      ),
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
        HttpResponse.json(firstPage),
      ),
    );

    renderTable();

    expect(await screen.findByText("Policy One")).toBeInTheDocument();
    expect(screen.getByLabelText("Open Policy One")).toHaveAttribute(
      "href",
      "/property-key-policies/policy-1",
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
            : firstPage,
        );
      }),
    );

    renderTable();

    expect(await screen.findByText("Policy One")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Supplied ID"), "supplied-2");

    expect(await screen.findByText("Policy Two")).toBeInTheDocument();
    expect(screen.queryByText("Policy One")).not.toBeInTheDocument();
    expect(
      requests.some(
        (search) =>
          new URLSearchParams(search).get("suppliedId") === "supplied-2",
      ),
    ).toBe(true);
  });

  it("deletes the selected policies and clears the selection on success", async () => {
    const deletedIds: string[][] = [];

    server.use(
      http.get("*/api/property-key-policies", () =>
        HttpResponse.json(firstPage),
      ),
      http.delete("*/api/property-key-policies", async ({ request }) => {
        const body = (await request.json()) as { ids?: string[] };
        deletedIds.push(body.ids ?? []);
        return HttpResponse.json({ status: 200 });
      }),
    );

    renderTable();

    expect(await screen.findByText("Policy One")).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("Select Policy One"));
    await userEvent.click(screen.getByLabelText("Delete"));

    // The DELETE fires immediately on the single click; no confirmation.
    await waitFor(() => {
      expect(deletedIds).toEqual([["policy-1"]]);
    });
    expect(screen.queryByText("1 selected")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Select Policy One")).not.toBeChecked();
  });

  it("shows an error, clears the selection, and refreshes the list when deleting fails", async () => {
    const deletedIds: string[][] = [];
    let getCount = 0;

    server.use(
      http.get("*/api/property-key-policies", () => {
        getCount += 1;
        return HttpResponse.json(firstPage);
      }),
      http.delete("*/api/property-key-policies", async ({ request }) => {
        const body = (await request.json()) as { ids?: string[] };
        deletedIds.push(body.ids ?? []);
        return HttpResponse.json(
          { message: "Could not delete policy-1.", status: 500 },
          { status: 500 },
        );
      }),
    );

    renderTable();

    expect(await screen.findByText("Policy One")).toBeInTheDocument();
    const getsBeforeDelete = getCount;

    await userEvent.click(screen.getByLabelText("Select Policy One"));
    await userEvent.click(screen.getByLabelText("Delete"));

    expect(
      await screen.findByText("Could not delete policy-1."),
    ).toBeInTheDocument();
    // On failure the selection clears and the list is reconciled with the
    // server via a re-fetch.
    expect(screen.queryByText("1 selected")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Select Policy One")).not.toBeChecked();
    await waitFor(() => expect(getCount).toBeGreaterThan(getsBeforeDelete));
    expect(deletedIds).toEqual([["policy-1"]]);
  });

  it("reconciles a partial delete and keeps only failed policies selected", async () => {
    const onPoliciesDeleted = jest.fn();
    const page = propertyKeyPoliciesPage({
      data: [
        propertyKeyPolicy({ id: "policy-1", name: "Deleted Policy" }),
        propertyKeyPolicy({ id: "policy-2", name: "Failed Policy" }),
      ],
    });

    server.use(
      http.get("*/api/property-key-policies", () => HttpResponse.json(page)),
      http.delete("*/api/property-key-policies", () =>
        HttpResponse.json(
          {
            deletedIds: ["policy-1"],
            failedIds: ["policy-2"],
            message: "Could not delete policy-2.",
            status: 207,
          },
          { status: 207 },
        ),
      ),
    );

    renderWithSWR(
      <PropertyKeyPolicyTable onPoliciesDeleted={onPoliciesDeleted} />,
    );

    expect(await screen.findByText("Deleted Policy")).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("Select Deleted Policy"));
    await userEvent.click(screen.getByLabelText("Select Failed Policy"));
    await userEvent.click(screen.getByLabelText("Delete"));

    expect(
      await screen.findByText("Could not delete policy-2."),
    ).toBeInTheDocument();
    expect(onPoliciesDeleted).toHaveBeenCalledWith(["policy-1"]);
    expect(screen.getByLabelText("Select Deleted Policy")).not.toBeChecked();
    expect(screen.getByLabelText("Select Failed Policy")).toBeChecked();
  });

  it("recovers from a non-JSON delete error without getting stuck", async () => {
    let getCount = 0;

    server.use(
      http.get("*/api/property-key-policies", () => {
        getCount += 1;
        return HttpResponse.json(firstPage);
      }),
      http.delete(
        "*/api/property-key-policies",
        () => new HttpResponse(null, { status: 500 }),
      ),
    );

    renderTable();

    expect(await screen.findByText("Policy One")).toBeInTheDocument();
    const getsBeforeDelete = getCount;

    await userEvent.click(screen.getByLabelText("Select Policy One"));
    await userEvent.click(screen.getByLabelText("Delete"));

    // A generic error surfaces (body could not be parsed as JSON) and the
    // component is not stuck: the list refreshes.
    expect(
      await screen.findByText(
        "Could not delete the selected property key policies.",
      ),
    ).toBeInTheDocument();
    await waitFor(() => expect(getCount).toBeGreaterThan(getsBeforeDelete));
  });

  it("notifies the parent with the deleted ids on success", async () => {
    const onPoliciesDeleted = jest.fn();

    server.use(
      http.get("*/api/property-key-policies", () =>
        HttpResponse.json(firstPage),
      ),
      http.delete("*/api/property-key-policies", () =>
        HttpResponse.json({ status: 200 }),
      ),
    );

    renderWithSWR(
      <PropertyKeyPolicyTable onPoliciesDeleted={onPoliciesDeleted} />,
    );

    expect(await screen.findByText("Policy One")).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("Select Policy One"));
    await userEvent.click(screen.getByLabelText("Delete"));

    await waitFor(() =>
      expect(onPoliciesDeleted).toHaveBeenCalledWith(["policy-1"]),
    );
  });

  it("clears the selection when the user navigates to the next page", async () => {
    const firstPageWithNext = propertyKeyPoliciesPage({
      cursors: { self: "page-1", next: "page-2" },
      data: [
        propertyKeyPolicy({
          id: "policy-1",
          mode: PropertyKeyPolicyMode.Allowlist,
          name: "Policy One",
          suppliedId: "supplied-1",
        }),
      ],
    });

    server.use(
      http.get("*/api/property-key-policies", () =>
        HttpResponse.json(firstPageWithNext),
      ),
    );

    renderTable();

    expect(await screen.findByText("Policy One")).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("Select Policy One"));
    expect(screen.getByText("1 selected")).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("Go to next page"));

    await waitFor(() => {
      expect(screen.queryByText("1 selected")).not.toBeInTheDocument();
    });
    expect(await screen.findByText("Policy One")).toBeInTheDocument();
    expect(screen.getByLabelText("Select Policy One")).not.toBeChecked();
  });

  it("renders the load error state when the list request fails", async () => {
    server.use(
      http.get("*/api/property-key-policies", () =>
        HttpResponse.json({ message: "boom", status: 500 }, { status: 500 }),
      ),
    );

    renderTable();

    expect(await screen.findByText("Error loading data.")).toBeInTheDocument();
  });
});

function renderTable(): void {
  renderWithSWR(<PropertyKeyPolicyTable />);
}
