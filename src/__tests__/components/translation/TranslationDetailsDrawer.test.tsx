import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import React from "react";

import { installJsdomMockServer } from "../../../../test/msw/installJsdomMockServer";
import { server } from "../../../../test/msw/server";
import { renderWithSWR } from "../../../../test/render/renderWithSWR";
import { QueuedTranslationsTable } from "../../../components/translation/QueuedTranslationsTable";
import { TranslationDetailsDrawer } from "../../../components/translation/TranslationDetailsDrawer";
import { toLocaleString } from "../../../lib/dates";
import { QueuedJob } from "../../../lib/queued-jobs";

function Harness(): JSX.Element {
  const [job, setJob] = React.useState<QueuedJob | undefined>();

  return (
    <>
      <QueuedTranslationsTable
        activeJobId={job?.id}
        onRowClick={setJob}
        status="running"
        title="Running Translations"
      />
      <TranslationDetailsDrawer
        job={job}
        onClose={() => setJob(undefined)}
        open={job != null}
      />
    </>
  );
}

describe("TranslationDetailsDrawer", () => {
  installJsdomMockServer();

  it("opens on row click and renders the full Vertex job payload", async () => {
    server.use(
      stubListQueuedTranslations(),
      http.get("*/api/queued-translations/job-1", () =>
        HttpResponse.json(queuedTranslationJobRes())
      )
    );

    renderWithSWR(<Harness />);

    await userEvent.click(await screen.findByText("job-1"));

    expect(
      await screen.findByText("Translation Job Details")
    ).toBeInTheDocument();

    // Copyable ID.
    expect(
      screen.getByRole("button", { name: "Copy job-1" })
    ).toBeInTheDocument();

    // All attributes returned by Vertex, including ones the table never shows.
    expect(await screen.findByText("complete")).toBeInTheDocument();
    expect(screen.getByText("queued-translation-job")).toBeInTheDocument();
    expect(
      screen.getByText(toLocaleString("2026-06-29T15:45:00Z"))
    ).toBeInTheDocument();
    expect(screen.getByText("Source File Name")).toBeInTheDocument();
    expect(screen.getByText("model.step")).toBeInTheDocument();

    // Relationships, links, and included resources.
    expect(screen.getByText("Part Revision")).toBeInTheDocument();
    expect(screen.getByText("part-revision rev-1")).toBeInTheDocument();
    expect(
      screen.getByText("https://vertex.test/queued-translation-jobs/job-1")
    ).toBeInTheDocument();
    expect(screen.getByText("rev-1")).toBeInTheDocument();
  });

  it("falls back to row data when the full job details cannot load", async () => {
    server.use(
      stubListQueuedTranslations(),
      http.get("*/api/queued-translations/job-1", () =>
        HttpResponse.json(
          { message: "Unknown error from Vertex API.", status: 500 },
          { status: 500 }
        )
      )
    );

    renderWithSWR(<Harness />);

    await userEvent.click(await screen.findByText("job-1"));

    expect(
      await screen.findByText(
        "Could not load full job details. Showing summary data."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("running")).toBeInTheDocument();
  });
});

function stubListQueuedTranslations() {
  return http.get("*/api/queued-translations", () =>
    HttpResponse.json({
      cursors: { next: null, self: null },
      data: [
        {
          attributes: { created: "2026-06-29T15:30:00Z", status: "running" },
          id: "job-1",
          type: "queued-translation",
        },
      ],
      status: 200,
    })
  );
}

function queuedTranslationJobRes() {
  return {
    data: {
      attributes: {
        completed: "2026-06-29T15:45:00Z",
        created: "2026-06-29T15:30:00Z",
        sourceFileName: "model.step",
        status: "complete",
      },
      id: "job-1",
      links: {
        self: { href: "https://vertex.test/queued-translation-jobs/job-1" },
      },
      relationships: {
        partRevision: { data: { id: "rev-1", type: "part-revision" } },
      },
      type: "queued-translation-job",
    },
    included: [
      {
        attributes: { suppliedId: "rev-1-supplied" },
        id: "rev-1",
        type: "part-revision",
      },
    ],
    links: {
      self: { href: "https://vertex.test/queued-translation-jobs/job-1" },
    },
    status: 200,
  };
}
