import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import React from "react";

import { installJsdomMockServer } from "../../../../test/msw/installJsdomMockServer";
import { server } from "../../../../test/msw/server";
import { renderWithSWR } from "../../../../test/render/renderWithSWR";
import PartTable from "../../../components/part/PartTable";

jest.mock("next/router", () => ({
  useRouter: () => ({ query: {} }),
}));

const page = {
  cursors: { self: "page-1" },
  data: [
    {
      type: "part",
      id: "part-1",
      attributes: {
        created: "2026-06-10T15:30:00Z",
        name: "alpha",
        suppliedId: "supplied-1",
      },
    },
  ],
  status: 200,
};

describe("PartTable", () => {
  installJsdomMockServer();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("deletes selected parts without a confirmation prompt", async () => {
    const deletedIds: string[][] = [];
    const confirm = jest.spyOn(window, "confirm").mockReturnValue(false);
    server.use(
      http.get("*/api/files", () =>
        HttpResponse.json({
          cursors: { self: "page-1" },
          data: [],
          status: 200,
        })
      ),
      http.get("*/api/parts", () => HttpResponse.json(page)),
      http.delete("*/api/parts", async ({ request }) => {
        const body = (await request.json()) as { ids?: string[] };
        deletedIds.push(body.ids ?? []);
        return HttpResponse.json({ status: 200 });
      })
    );

    renderWithSWR(<PartTable onRevisionSelected={jest.fn()} />);

    expect(await screen.findByText("alpha")).toBeInTheDocument();
    const partRow = screen.getByText("alpha").closest("tr");
    expect(partRow).not.toBeNull();
    if (partRow == null)
      throw new Error("Expected the selected part to have a table row.");

    const selectionCell = partRow.querySelector("td:nth-child(2)");
    if (selectionCell == null)
      throw new Error("Expected the part row to have a selection cell.");

    await userEvent.click(selectionCell);
    await userEvent.click(screen.getByLabelText("Delete"));

    await waitFor(() => expect(deletedIds).toEqual([["part-1"]]));
    expect(confirm).not.toHaveBeenCalled();
  });
});
