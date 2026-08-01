import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PropertyKeyPolicyMode } from "@vertexvis/api-client-node";
import React from "react";

import { renderWithSWR } from "../../../test/render/renderWithSWR";
import PropertyKeyPolicies from "../../pages/property-key-policies";

jest.mock(
  "next/dynamic",
  () => () =>
    function PropertyKeyPolicyTable({
      onPoliciesDeleted,
      onPropertyKeyPolicySelected,
    }: {
      readonly onPoliciesDeleted?: (ids: string[]) => void;
      readonly onPropertyKeyPolicySelected?: (policy: {
        readonly createdAt: string;
        readonly id: string;
        readonly mode: PropertyKeyPolicyMode;
        readonly name: string;
      }) => void;
    }) {
      const policy = {
        createdAt: "2026-06-10T15:30:00Z",
        id: "policy-1",
        mode: PropertyKeyPolicyMode.Allowlist,
        name: "Policy One",
      };

      return (
        <>
          <button onClick={() => onPropertyKeyPolicySelected?.(policy)}>
            Select policy
          </button>
          <button onClick={() => onPoliciesDeleted?.([policy.id])}>
            Delete policy
          </button>
        </>
      );
    },
);

jest.mock("../../components/shared/Layout", () => ({
  Layout: ({
    main,
    rightDrawer,
  }: {
    main: React.ReactNode;
    rightDrawer: React.ReactNode;
  }) => (
    <>
      {main}
      {rightDrawer}
    </>
  ),
}));

jest.mock(
  "../../components/property-key-policy/PropertyKeyPolicyDetailsDrawer",
  () => ({
    PropertyKeyPolicyDetailsDrawer: ({ open }: { readonly open: boolean }) => (
      <div data-testid="property-key-policy-drawer">
        {open ? "open" : "closed"}
      </div>
    ),
  }),
);

describe("PropertyKeyPolicies", () => {
  it("closes the details drawer when its active policy is deleted", async () => {
    renderWithSWR(<PropertyKeyPolicies />);

    expect(screen.getByTestId("property-key-policy-drawer")).toHaveTextContent(
      "closed",
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Select policy" }),
    );
    expect(screen.getByTestId("property-key-policy-drawer")).toHaveTextContent(
      "open",
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Delete policy" }),
    );
    expect(screen.getByTestId("property-key-policy-drawer")).toHaveTextContent(
      "closed",
    );
  });
});
