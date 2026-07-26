import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import React from "react";

import { installJsdomMockServer } from "../../../../test/msw/installJsdomMockServer";
import { server } from "../../../../test/msw/server";
import { renderWithSWR } from "../../../../test/render/renderWithSWR";
import CreatePartDialog from "../../../components/part/CreatePartDialog";

describe("CreatePartDialog", () => {
  installJsdomMockServer();

  beforeEach(() => {
    server.use(
      http.get("*/api/files", () =>
        HttpResponse.json({
          cursors: { self: "page-1" },
          data: [],
          status: 200,
        })
      )
    );
  });

  it("enables submit for a target supplied via props after an open toggle", async () => {
    // Reproduces the row-action mount path: the dialog is rendered up front
    // with no target, then the target arrives by prop when a row action fires.
    const { rerender } = renderWithSWR(
      <CreatePartDialog
        open={false}
        onClose={jest.fn()}
        onPartCreated={jest.fn()}
      />
    );

    rerender(
      <CreatePartDialog
        open
        onClose={jest.fn()}
        onPartCreated={jest.fn()}
        targetFileId="file-1"
        targetFileName="alpha.jt"
      />
    );

    expect(await screen.findByText("alpha.jt")).toBeInTheDocument();
    const createButton = screen.getByRole("button", { name: "Create" });
    expect(createButton).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/^Supplied ID/), "supplied-1");
    await userEvent.type(
      screen.getByLabelText(/^Supplied Revision ID/),
      "rev-1"
    );

    await waitFor(() => expect(createButton).toBeEnabled());
  });

  it("submits the targeted file and reports the queued translation id", async () => {
    const requests: Array<Record<string, unknown>> = [];
    server.use(
      http.post("*/api/parts", async ({ request }) => {
        requests.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ id: "job-1", status: 200 });
      })
    );
    const onPartCreated = jest.fn();

    const { rerender } = renderWithSWR(
      <CreatePartDialog
        open={false}
        onClose={jest.fn()}
        onPartCreated={onPartCreated}
      />
    );
    rerender(
      <CreatePartDialog
        open
        onClose={jest.fn()}
        onPartCreated={onPartCreated}
        targetFileId="file-1"
        targetFileName="alpha.jt"
      />
    );

    await screen.findByText("alpha.jt");
    await userEvent.type(screen.getByLabelText(/^Supplied ID/), "supplied-1");
    await userEvent.type(
      screen.getByLabelText(/^Supplied Revision ID/),
      "rev-1"
    );

    const createButton = screen.getByRole("button", { name: "Create" });
    await waitFor(() => expect(createButton).toBeEnabled());
    await userEvent.click(createButton);

    await waitFor(() => expect(onPartCreated).toHaveBeenCalledWith("job-1"));
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      fileId: "file-1",
      suppliedId: "supplied-1",
      suppliedRevisionId: "rev-1",
    });
  });
});
