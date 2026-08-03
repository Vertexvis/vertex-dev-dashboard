import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import React from "react";

import { installJsdomMockServer } from "../../../../test/msw/installJsdomMockServer";
import { server } from "../../../../test/msw/server";
import { renderWithSWR } from "../../../../test/render/renderWithSWR";
import { IdentityAdminPage } from "../../../components/identity-admin/IdentityAdminPage";

describe("IdentityAdminPage", () => {
  installJsdomMockServer();

  it("lists users and loads canonical group memberships", async () => {
    server.use(
      http.get("*/api/identity-admin/users", () =>
        HttpResponse.json({
          cursors: {},
          data: [
            {
              attributes: {
                email: "admin@example.test",
                fullName: "Admin User",
                idpId: "idp-1",
              },
              id: "user-1",
              type: "user",
            },
          ],
          status: 200,
        })
      ),
      http.get("*/api/identity-admin/users/user-1/groups", () =>
        HttpResponse.json({
          cursors: {},
          data: [
            {
              attributes: { name: "Engineering" },
              id: "group-1",
              type: "user-group",
            },
          ],
          status: 200,
        })
      )
    );
    const user = userEvent.setup();
    renderWithSWR(<IdentityAdminPage />);

    expect(await screen.findByText("Admin User")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Group memberships" }));

    expect(await screen.findByText(/Engineering \(group-1\)/)).toBeVisible();
  });

  it("shows a capability response and masks webhook endpoints", async () => {
    server.use(
      http.get("*/api/identity-admin/applications", () =>
        HttpResponse.json(
          { message: "Applications unavailable.", status: 403 },
          { status: 403 }
        )
      ),
      http.get("*/api/identity-admin/webhook-subscriptions", () =>
        HttpResponse.json({
          cursors: {},
          data: [
            {
              attributes: {
                status: "active",
                topics: ["scene.created"],
                url: "https://subscriber.example/…",
              },
              id: "webhook-1",
              type: "webhook-subscription",
            },
          ],
          status: 200,
        })
      )
    );
    const user = userEvent.setup();
    renderWithSWR(<IdentityAdminPage />);

    await user.click(screen.getByRole("tab", { name: "Applications" }));
    expect(await screen.findByText("Applications unavailable.")).toBeVisible();
    await user.click(screen.getByRole("tab", { name: "Webhooks" }));
    expect(
      await screen.findByText("https://subscriber.example/…")
    ).toBeVisible();
    expect(
      screen.getByText(/Endpoints are masked and signing secrets are redacted/)
    ).toBeVisible();
  });
});
