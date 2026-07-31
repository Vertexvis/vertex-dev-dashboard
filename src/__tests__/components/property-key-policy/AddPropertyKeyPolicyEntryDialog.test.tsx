import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import React from "react";

import { installJsdomMockServer } from "../../../../test/msw/installJsdomMockServer";
import { server } from "../../../../test/msw/server";
import { renderWithSWR } from "../../../../test/render/renderWithSWR";
import AddPropertyKeyPolicyEntryDialog from "../../../components/property-key-policy/AddPropertyKeyPolicyEntryDialog";

describe("AddPropertyKeyPolicyEntryDialog", () => {
  installJsdomMockServer();

  it("shows the case-sensitivity helper text", () => {
    renderDialog();

    expect(
      screen.getByText(
        "Metadata property keys are case-sensitive and are saved exactly as typed."
      )
    ).toBeInTheDocument();
  });

  it("submits multiple keys verbatim (case preserved) and calls onAdded", async () => {
    const bodies: Array<Record<string, unknown>> = [];

    server.use(
      http.post("*/api/property-key-policies/:id/keys", async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ status: 201 }, { status: 201 });
      })
    );

    const onAdded = jest.fn();
    const onClose = jest.fn();
    renderDialog({ onAdded, onClose });

    await userEvent.type(
      screen.getByLabelText("Property key 1"),
      "MixedCase_Key"
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Add Property Key" })
    );
    await userEvent.type(screen.getByLabelText("Property key 2"), "second_KEY");

    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ keys: ["MixedCase_Key", "second_KEY"] });
    await waitFor(() => expect(onAdded).toHaveBeenCalled());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("filters blank keys before submitting", async () => {
    const bodies: Array<Record<string, unknown>> = [];

    server.use(
      http.post("*/api/property-key-policies/:id/keys", async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ status: 201 }, { status: 201 });
      })
    );

    renderDialog();

    await userEvent.type(screen.getByLabelText("Property key 1"), "Only_Key");
    // Add a second, blank row that must be filtered out of the payload.
    await userEvent.click(
      screen.getByRole("button", { name: "Add Property Key" })
    );

    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ keys: ["Only_Key"] });
  });

  it("shows the API error message when the add fails", async () => {
    server.use(
      http.post("*/api/property-key-policies/:id/keys", () =>
        HttpResponse.json(
          { message: "Could not add keys.", status: 400 },
          { status: 400 }
        )
      )
    );

    const onAdded = jest.fn();
    const onClose = jest.fn();
    renderDialog({ onAdded, onClose });

    await userEvent.type(screen.getByLabelText("Property key 1"), "Key");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByText("Could not add keys.")).toBeInTheDocument();
    expect(onAdded).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    // Dialog stays open and keeps the entered value.
    expect(screen.getByLabelText("Property key 1")).toHaveValue("Key");
  });
});

function renderDialog(
  props: {
    readonly onAdded?: () => void;
    readonly onClose?: () => void;
    readonly policyId?: string;
  } = {}
): void {
  renderWithSWR(
    <AddPropertyKeyPolicyEntryDialog
      onAdded={props.onAdded ?? jest.fn()}
      onClose={props.onClose ?? jest.fn()}
      open
      policyId={props.policyId ?? "policy-1"}
    />
  );
}
