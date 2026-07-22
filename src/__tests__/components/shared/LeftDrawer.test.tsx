import { render, screen } from "@testing-library/react";
import React from "react";

import { LeftDrawer } from "../../../components/shared/LeftDrawer";

const mockRouter = { route: "/identity-admin" };

jest.mock("next/router", () => ({
  useRouter: () => mockRouter,
}));

describe("LeftDrawer", () => {
  it("provides an SPA link to the additive Identity & Administration workspace", () => {
    render(<LeftDrawer />);

    expect(
      screen.getByRole("link", { name: "Identity & Administration" })
    ).toHaveAttribute("href", "/identity-admin");
  });
});
