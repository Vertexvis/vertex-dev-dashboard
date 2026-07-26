import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import React from "react";

import { installJsdomMockServer } from "../../../../test/msw/installJsdomMockServer";
import { server } from "../../../../test/msw/server";
import { FilePreviewDialog } from "../../../components/file/FilePreviewDialog";
import { File } from "../../../lib/files";

const mockRender = jest.fn(() => ({ promise: Promise.resolve() }));
const mockGetPage = jest.fn(async () => ({
  getViewport: () => ({ width: 100, height: 150 }),
  render: mockRender,
}));
const mockGetDocument = jest.fn(() => ({
  promise: Promise.resolve({ getPage: mockGetPage }),
  destroy: jest.fn(),
}));

jest.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: { workerSrc: "" },
  getDocument: (...args: unknown[]) => mockGetDocument(...args),
}));

function makeFile(overrides: Partial<File> = {}): File {
  return {
    created: "2026-07-21T12:00:00Z",
    id: "file-1",
    name: "photo.png",
    status: "complete",
    suppliedId: "supplied-1",
    uploaded: "2026-07-21T12:01:00Z",
    ...overrides,
  } as unknown as File;
}

describe("FilePreviewDialog", () => {
  installJsdomMockServer();

  let getContextSpy: jest.SpyInstance;

  beforeEach(() => {
    mockGetDocument.mockClear();
    mockGetPage.mockClear();
    mockRender.mockClear();
    // jsdom has no 2d canvas context without the native `canvas` package; stub
    // it so the pdf.js render path can run.
    getContextSpy = jest
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue({} as unknown as CanvasRenderingContext2D);
  });

  afterEach(() => {
    getContextSpy.mockRestore();
  });

  it("renders an image with the inline src and an always-present Download action", () => {
    render(
      <FilePreviewDialog file={makeFile()} onClose={jest.fn()} open={true} />
    );

    const img = screen.getByAltText("photo.png") as HTMLImageElement;
    expect(img).toHaveAttribute(
      "src",
      "/api/files/file-1/inline?name=photo.png"
    );

    const download = screen.getByRole("link", { name: /download/i });
    expect(download).toHaveAttribute("href", "/api/files/file-1/download");
  });

  it("shows the gating reason for an oversized file but still offers Download", () => {
    render(
      <FilePreviewDialog
        file={makeFile({ size: 999 * 1024 * 1024 })}
        onClose={jest.fn()}
        open={true}
      />
    );

    expect(
      screen.getByText(/File is too large to preview/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /download/i })).toBeInTheDocument();
    expect(screen.queryByAltText("photo.png")).not.toBeInTheDocument();
  });

  it("shows the gating reason for a non-previewable type", () => {
    render(
      <FilePreviewDialog
        file={makeFile({ name: "model.jt" })}
        onClose={jest.fn()}
        open={true}
      />
    );

    expect(
      screen.getByText(/can't be previewed in the browser/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /download/i })).toBeInTheDocument();
  });

  it("fetches and renders text content", async () => {
    server.use(
      http.get("*/api/files/file-1/inline", () =>
        HttpResponse.text("hello from the text file")
      )
    );

    render(
      <FilePreviewDialog
        file={makeFile({ name: "notes.txt" })}
        onClose={jest.fn()}
        open={true}
      />
    );

    expect(
      await screen.findByText("hello from the text file")
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /download/i })).toBeInTheDocument();
  });

  it("attempts to render a PDF via pdf.js onto a canvas", async () => {
    render(
      <FilePreviewDialog
        file={makeFile({ name: "doc.pdf" })}
        onClose={jest.fn()}
        open={true}
      />
    );

    await waitFor(() => expect(mockGetDocument).toHaveBeenCalled());
    expect(mockGetDocument).toHaveBeenCalledWith(
      "/api/files/file-1/inline?name=doc.pdf"
    );
    await waitFor(() => expect(mockRender).toHaveBeenCalled());
    expect(screen.getByLabelText("PDF preview of doc.pdf")).toBeInTheDocument();
  });

  it("shows a PDF error fallback when pdf.js fails", async () => {
    mockGetDocument.mockImplementationOnce(() => ({
      promise: Promise.reject(new Error("boom")),
      destroy: jest.fn(),
    }));

    render(
      <FilePreviewDialog
        file={makeFile({ name: "doc.pdf" })}
        onClose={jest.fn()}
        open={true}
      />
    );

    expect(
      await screen.findByText(/Couldn't preview this PDF/i)
    ).toBeInTheDocument();
  });

  it("falls back to a download message when text loading fails", async () => {
    server.use(
      http.get("*/api/files/file-1/inline", () =>
        HttpResponse.text("boom", { status: 500 })
      )
    );

    render(
      <FilePreviewDialog
        file={makeFile({ name: "notes.txt" })}
        onClose={jest.fn()}
        open={true}
      />
    );

    expect(await screen.findByText(/download it to view/i)).toBeInTheDocument();
  });
});
