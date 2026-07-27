import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import React from "react";

import {
  propertyKeyPolicy,
  propertyKeyPolicyRes,
} from "../../../../test/msw/handlers/property-key-policies";
import { installJsdomMockServer } from "../../../../test/msw/installJsdomMockServer";
import { server } from "../../../../test/msw/server";
import { renderWithSWR } from "../../../../test/render/renderWithSWR";
import CreatePropertyKeyPolicyDialog from "../../../components/property-key-policy/CreatePropertyKeyPolicyDialog";

describe("CreatePropertyKeyPolicyDialog", () => {
  installJsdomMockServer();

  it("shows the case-sensitivity helper text", () => {
    renderDialog();

    expect(
      screen.getByText(
        "Metadata property keys are case-sensitive and are saved exactly as typed."
      )
    ).toBeInTheDocument();
  });

  it("submits the key verbatim and maps the Deny mode to denylist", async () => {
    const bodies: Array<Record<string, unknown>> = [];

    server.use(
      http.post("*/api/property-key-policies", async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json(
          propertyKeyPolicyRes(propertyKeyPolicy({ id: "policy-1" })),
          { status: 201 }
        );
      })
    );

    const onCreated = jest.fn();
    const onClose = jest.fn();
    renderDialog({ onClose, onCreated });

    await userEvent.type(screen.getByLabelText(/Name/), "My Policy");
    await userEvent.click(screen.getByRole("radio", { name: "Deny" }));
    await userEvent.type(
      screen.getByLabelText("Property key 1"),
      "MixedCase_Key"
    );

    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({
      keys: ["MixedCase_Key"],
      mode: "denylist",
      name: "My Policy",
    });
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("shows the API error message when creation fails", async () => {
    server.use(
      http.post("*/api/property-key-policies", () =>
        HttpResponse.json(
          { message: "Name already in use.", status: 400 },
          { status: 400 }
        )
      )
    );

    const onCreated = jest.fn();
    renderDialog({ onCreated });

    await userEvent.type(screen.getByLabelText(/Name/), "Dup");
    await userEvent.type(screen.getByLabelText("Property key 1"), "Key");
    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByText("Name already in use.")).toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();
    // Dialog stays open and keeps entered values.
    expect(screen.getByLabelText(/Name/)).toHaveValue("Dup");
  });

  it("warns when the policy is created but its keys fail", async () => {
    server.use(
      http.post("*/api/property-key-policies", () =>
        HttpResponse.json(
          {
            data: propertyKeyPolicy({ id: "policy-1" }),
            entriesError: "Entries upsert failed.",
            status: 201,
          },
          { status: 201 }
        )
      )
    );

    const onCreated = jest.fn();
    const onClose = jest.fn();
    renderDialog({ onClose, onCreated });

    await userEvent.type(screen.getByLabelText(/Name/), "Partial");
    await userEvent.type(screen.getByLabelText("Property key 1"), "Key");
    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(
      await screen.findByText(/Entries upsert failed\./)
    ).toBeInTheDocument();
    // Refresh is still triggered so the created policy is visible, but the
    // dialog stays open to surface the warning.
    expect(onCreated).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});

function renderDialog(
  props: {
    readonly onClose?: () => void;
    readonly onCreated?: () => void;
  } = {}
): void {
  renderWithSWR(
    <CreatePropertyKeyPolicyDialog
      onClose={props.onClose ?? jest.fn()}
      onCreated={props.onCreated ?? jest.fn()}
      open
    />
  );
}
