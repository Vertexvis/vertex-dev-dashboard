import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import React from "react";

import { installJsdomMockServer } from "../../../../test/msw/installJsdomMockServer";
import { server } from "../../../../test/msw/server";
import { renderWithSWR } from "../../../../test/render/renderWithSWR";
import { PropertyKeyPolicyKeysList } from "../../../components/property-key-policy/PropertyKeyPolicyKeysList";
import { PropertyKeyPolicyKey } from "../../../lib/property-key-policies";

const keys: readonly PropertyKeyPolicyKey[] = [
  { id: "key-1", name: "Alpha" },
  { id: "key-2", name: "Beta" },
];

describe("PropertyKeyPolicyKeysList", () => {
  installJsdomMockServer();

  it("renders read-only with no editing controls when editing props are absent", () => {
    renderWithSWR(<PropertyKeyPolicyKeysList keys={keys} />);

    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    // Protects the drawer: no delete, no checkbox, no add controls.
    expect(screen.queryByLabelText("Delete Alpha")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Select Alpha")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add property key(s)" })
    ).not.toBeInTheDocument();
  });

  it("renders delete buttons, checkboxes, and an add button in editable mode", () => {
    renderWithSWR(
      <PropertyKeyPolicyKeysList
        keys={keys}
        onMutate={jest.fn()}
        policyId="policy-1"
      />
    );

    expect(screen.getByLabelText("Delete Alpha")).toBeInTheDocument();
    expect(screen.getByLabelText("Delete Beta")).toBeInTheDocument();
    expect(screen.getByLabelText("Select Alpha")).toBeInTheDocument();
    expect(screen.getByLabelText("Select Beta")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add property key(s)" })
    ).toBeInTheDocument();
  });

  it("deletes a single key by id and triggers mutate", async () => {
    const deletedIds: string[][] = [];
    const onMutate = jest.fn();

    server.use(
      http.delete(
        "*/api/property-key-policies/:id/keys",
        async ({ request }) => {
          const body = (await request.json()) as { ids?: string[] };
          deletedIds.push(body.ids ?? []);
          return HttpResponse.json({ status: 200 });
        }
      )
    );

    renderWithSWR(
      <PropertyKeyPolicyKeysList
        keys={keys}
        onMutate={onMutate}
        policyId="policy-1"
      />
    );

    await userEvent.click(screen.getByLabelText("Delete Alpha"));

    await waitFor(() => expect(deletedIds).toEqual([["key-1"]]));
    await waitFor(() => expect(onMutate).toHaveBeenCalled());
  });

  it("bulk deletes the selected key ids", async () => {
    const deletedIds: string[][] = [];
    const onMutate = jest.fn();

    server.use(
      http.delete(
        "*/api/property-key-policies/:id/keys",
        async ({ request }) => {
          const body = (await request.json()) as { ids?: string[] };
          deletedIds.push(body.ids ?? []);
          return HttpResponse.json({ status: 200 });
        }
      )
    );

    renderWithSWR(
      <PropertyKeyPolicyKeysList
        keys={keys}
        onMutate={onMutate}
        policyId="policy-1"
      />
    );

    await userEvent.click(screen.getByLabelText("Select Alpha"));
    await userEvent.click(screen.getByLabelText("Select Beta"));
    await userEvent.click(screen.getByRole("button", { name: /Delete \(2\)/ }));

    await waitFor(() => expect(deletedIds).toEqual([["key-1", "key-2"]]));
    await waitFor(() => expect(onMutate).toHaveBeenCalled());
  });

  it("surfaces a snackbar error when a delete fails", async () => {
    const onMutate = jest.fn();

    server.use(
      http.delete("*/api/property-key-policies/:id/keys", () =>
        HttpResponse.json(
          { message: "Could not delete key-1.", status: 500 },
          { status: 500 }
        )
      )
    );

    renderWithSWR(
      <PropertyKeyPolicyKeysList
        keys={keys}
        onMutate={onMutate}
        policyId="policy-1"
      />
    );

    await userEvent.click(screen.getByLabelText("Delete Alpha"));

    expect(
      await screen.findByText("Could not delete key-1.")
    ).toBeInTheDocument();
    expect(onMutate).not.toHaveBeenCalled();
  });
});
