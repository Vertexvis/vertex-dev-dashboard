import { expect, test } from "playwright/test";

test.use({ storageState: "e2e/.auth/session.json" });

test("inspects the directory and safely masked webhook subscriptions", async ({
  page,
}) => {
  await page.route("**/api/identity-admin/users**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
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
      }),
    });
  });
  await page.route(
    "**/api/identity-admin/webhook-subscriptions**",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
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
        }),
      });
    }
  );

  await page.goto("/identity-admin");
  await expect(
    page.getByRole("heading", { name: "Identity & Administration" })
  ).toBeVisible();
  await expect(page.getByText("Admin User")).toBeVisible();

  await page.getByRole("tab", { name: "Webhooks" }).click();
  await expect(page.getByText("https://subscriber.example/…")).toBeVisible();
  await expect(page.getByText("Webhook subscriptions")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(
    "must-not-reach-browser"
  );
});
