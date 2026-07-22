import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import React from "react";

import { installJsdomMockServer } from "../../../../test/msw/installJsdomMockServer";
import { server } from "../../../../test/msw/server";
import { renderWithSWR } from "../../../../test/render/renderWithSWR";
import { PropertiesSearchPage } from "../../../components/properties-search/PropertiesSearchPage";

const mockReplace = jest.fn();
const mockRouter = {
  pathname: "/properties-search",
  query: {} as Record<string, string>,
  replace: mockReplace,
};

jest.mock("next/router", () => ({
  useRouter: () => mockRouter,
}));

describe("PropertiesSearchPage", () => {
  installJsdomMockServer();

  beforeEach(() => {
    mockReplace.mockReset();
    mockRouter.query = {};
  });

  it("does not fetch property entries until a complete target is selected and pages with the returned cursor", async () => {
    const requests: URL[] = [];
    server.use(
      http.get("*/api/property-entries", ({ request }) => {
        const url = new URL(request.url);
        requests.push(url);
        expect(url.searchParams.get("resourceId")).toBe("item-1");
        expect(url.searchParams.get("resourceType")).toBe("scene-item");
        return HttpResponse.json({
          cursors: url.searchParams.get("cursor") ? {} : { next: "cursor-2" },
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
        });
      })
    );
    const user = userEvent.setup();
    renderWithSWR(<PropertiesSearchPage />);

    expect(requests).toHaveLength(0);
    await user.type(screen.getByLabelText("Resource ID"), "item-1");
    expect(requests).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Load entries" }));

    expect(await screen.findByText("material")).toBeVisible();
    expect(requests).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(await screen.findByText("entry-2")).toBeVisible();
    expect(requests.at(-1)?.searchParams.get("cursor")).toBe("cursor-2");
  });

  it("shows a direct-ID search-session capability error", async () => {
    server.use(
      http.get("*/api/search-sessions/session-1", () =>
        HttpResponse.json(
          { message: "Search sessions are unavailable.", status: 403 },
          { status: 403 }
        )
      )
    );
    const user = userEvent.setup();
    renderWithSWR(<PropertiesSearchPage />);

    await user.click(screen.getByRole("tab", { name: "Search sessions" }));
    await user.type(screen.getByLabelText("Search session ID"), "session-1");
    await user.click(screen.getByRole("button", { name: "Load status" }));

    expect(
      await screen.findByText("Search sessions are unavailable.")
    ).toBeVisible();
  });

  it("shows a policy capability error instead of an empty policy table", async () => {
    server.use(
      http.get("*/api/property-key-policies", () =>
        HttpResponse.json(
          { message: "Policies are unavailable.", status: 403 },
          { status: 403 }
        )
      )
    );
    const user = userEvent.setup();
    renderWithSWR(<PropertiesSearchPage />);

    await user.click(screen.getByRole("tab", { name: "Key policies" }));

    expect(await screen.findByText("Policies are unavailable.")).toBeVisible();
    expect(screen.queryByText("No property key policies found.")).toBeNull();
  });

  it("opens a valid tab from the URL and preserves SPA tab navigation", async () => {
    mockRouter.query = { tab: "policies" };
    server.use(
      http.get("*/api/property-key-policies", () =>
        HttpResponse.json({ cursors: {}, data: [], status: 200 })
      )
    );
    const user = userEvent.setup();
    renderWithSWR(<PropertiesSearchPage />);

    await screen.findByRole("heading", { name: "Property key policies" });
    await user.click(screen.getByRole("tab", { name: "Search sessions" }));

    expect(mockReplace).toHaveBeenCalledWith(
      {
        pathname: "/properties-search",
        query: { tab: "sessions" },
      },
      undefined,
      { shallow: true }
    );
  });
});
