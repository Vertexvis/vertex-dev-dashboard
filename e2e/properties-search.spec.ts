import { expect, test } from "playwright/test";

test.use({ storageState: "e2e/.auth/session.json" });

test("exercises scoped property entries and direct search-session status", async ({
  page,
}) => {
  const entryRequests: URL[] = [];
  const policyRequests: URL[] = [];
  await page.route("**/api/property-entries**", async (route) => {
    const url = new URL(route.request().url());
    entryRequests.push(url);
    expect(url.searchParams.get("resourceId")).toBe("scene-item-1");
    expect(url.searchParams.get("resourceType")).toBe("scene-item");
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        cursors: url.searchParams.get("cursor")
          ? {}
          : { next: "entry-cursor-2" },
        data: [
          {
            attributes: {
              key: { name: "material" },
              value: { type: "string", value: "steel" },
            },
            id: url.searchParams.get("cursor") ? "entry-2" : "entry-1",
            type: "property-entry",
          },
        ],
        status: 200,
      }),
    });
  });
  await page.route("**/api/property-key-policies**", async (route) => {
    const url = new URL(route.request().url());
    policyRequests.push(url);
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        cursors: url.searchParams.get("cursor")
          ? {}
          : { next: "policy-cursor-2" },
        data: [
          {
            attributes: {
              mode: "allowlist",
              name: "Engineering",
              suppliedId: "engineering",
            },
            id: url.searchParams.get("cursor") ? "policy-2" : "policy-1",
            type: "property-key-policy",
          },
        ],
        status: 200,
      }),
    });
  });
  await page.route("**/api/search-sessions/session-1", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        attributes: { status: "running" },
        id: "session-1",
        type: "search-session",
      }),
    });
  });

  await page.goto("/properties-search");
  await expect(
    page.getByRole("heading", { name: "Properties & Search" })
  ).toBeVisible();
  await page.getByLabel("Resource ID").fill("scene-item-1");
  await page.getByRole("button", { name: "Load entries" }).click();
  await expect(page.getByText("material")).toBeVisible();
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByText("entry-2")).toBeVisible();
  expect(entryRequests.at(-1)?.searchParams.get("cursor")).toBe(
    "entry-cursor-2"
  );

  await page.getByRole("tab", { name: "Key policies" }).click();
  await expect(page.getByText("policy-1")).toBeVisible();
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByText("policy-2")).toBeVisible();
  expect(policyRequests.at(-1)?.searchParams.get("cursor")).toBe(
    "policy-cursor-2"
  );

  await page.getByRole("tab", { name: "Search sessions" }).click();
  await page.getByLabel("Search session ID").fill("session-1");
  await page.getByRole("button", { name: "Load status" }).click();
  await expect(page.locator("p", { hasText: "Status:" })).toContainText(
    "running"
  );
});

test("shows policy capability failures", async ({ page }) => {
  await page.route("**/api/property-key-policies**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      status: 403,
      body: JSON.stringify({
        message: "Policies are unavailable.",
        status: 403,
      }),
    });
  });

  await page.goto("/properties-search?tab=policies");
  await expect(page.getByText("Policies are unavailable.")).toBeVisible();
  await expect(page.getByText("No property key policies found.")).toHaveCount(
    0
  );
});
