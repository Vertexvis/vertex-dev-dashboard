import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import PartRow from "../../../components/part/PartRow";

const part = {
  id: "part-1",
  created: "2026-06-10T15:30:00Z",
  name: "Part One",
  suppliedId: "supplied-part-1",
};

const revisionsPage = {
  cursors: { self: "page-1" },
  data: [
    {
      type: "part-revision",
      id: "revision-1",
      attributes: {
        created: "2026-06-11T15:30:00Z",
        name: "Revision One",
        suppliedId: "supplied-revision-1",
        suppliedIterationId: "iteration-1",
      },
    },
  ],
  status: 200,
};

describe("PartRow", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("opens the active part and selects revisions with their parent part ID", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve(revisionsPage),
    }) as unknown as typeof fetch;
    const onRevisionSelected = jest.fn();

    renderPartRow({
      activePartId: "part-1",
      activeRevisionId: "revision-1",
      onRevisionSelected,
    });

    expect(await screen.findByText("Revision One")).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/part-revisions?partId=part-1"
    );

    await userEvent.click(screen.getByText("Revision One"));

    expect(onRevisionSelected).toHaveBeenCalledWith(
      {
        created: "2026-06-11T15:30:00Z",
        id: "revision-1",
        name: "Revision One",
        suppliedId: "supplied-revision-1",
        suppliedIterationId: "iteration-1",
      },
      "part-1"
    );
  });

  it("keeps part checkbox selection separate from revision selection", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve(revisionsPage),
    }) as unknown as typeof fetch;
    const onSelected = jest.fn();
    const onRevisionSelected = jest.fn();

    renderPartRow({
      onRevisionSelected,
      onSelected,
    });

    await userEvent.click(screen.getByLabelText("Select Part One"));

    expect(onSelected).toHaveBeenCalledWith("part-1");
    expect(onRevisionSelected).not.toHaveBeenCalled();
  });
});

function renderPartRow(
  props: Partial<React.ComponentProps<typeof PartRow>> = {}
): void {
  render(
    <table>
      <tbody>
        <PartRow
          isSelected={false}
          onCreteSceneFromRevision={jest.fn()}
          onRevisionSelected={jest.fn()}
          onSelected={jest.fn()}
          part={part}
          {...props}
        />
      </tbody>
    </table>
  );
}
