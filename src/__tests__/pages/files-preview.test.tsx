import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import { renderWithSWR } from "../../../test/render/renderWithSWR";
import { File } from "../../lib/files";
import FilesPreview from "../../pages/files-preview";

jest.mock("next/router", () => ({
  useRouter: () => ({ push: jest.fn(), query: {} }),
}));

// The page loads FileTable through next/dynamic; resolve it synchronously so
// the mocked FileTable below renders inline in the test.
jest.mock("next/dynamic", () => ({
  __esModule: true,
  default: () =>
    jest.requireMock("../../components/file/FileTable").default,
}));

// Render only the page's own content so we exercise the Create Part + toast
// wiring without pulling in the full Layout/LeftDrawer chrome.
jest.mock("../../components/shared/Layout", () => ({
  __esModule: true,
  Layout: ({ main }: { main: React.ReactNode }) => <div>{main}</div>,
}));

jest.mock("../../components/file/FileDetailsDrawer", () => ({
  __esModule: true,
  FileDetailsDrawer: () => null,
}));

const eligibleFile = {
  id: "file-1",
  name: "alpha.jt",
  status: "complete",
} as unknown as File;

// A lightweight FileTable double that surfaces the onCreatePart callback.
jest.mock("../../components/file/FileTable", () => ({
  __esModule: true,
  default: ({ onCreatePart }: { onCreatePart?: (file: File) => void }) => (
    <button
      onClick={() => onCreatePart?.(eligibleFile)}
      type="button"
    >
      Trigger create part
    </button>
  ),
}));

// A CreatePartDialog double that simulates a successful part creation.
jest.mock("../../components/part/CreatePartDialog", () => ({
  __esModule: true,
  default: ({
    onPartCreated,
    open,
    targetFileName,
  }: {
    onPartCreated: (id: string) => void;
    open: boolean;
    targetFileName?: string;
  }) =>
    open ? (
      <div>
        <span>Creating part for {targetFileName}</span>
        <button onClick={() => onPartCreated("job-1")} type="button">
          Simulate part created
        </button>
      </div>
    ) : null,
}));

describe("FilesPreview page", () => {
  it("opens the Create Part dialog for the selected file and links the success toast to translations", async () => {
    renderWithSWR(<FilesPreview />);

    await userEvent.click(
      screen.getByRole("button", { name: "Trigger create part" })
    );

    expect(screen.getByText("Creating part for alpha.jt")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Simulate part created" })
    );

    expect(
      screen.getByText("Translation initiated. Job ID: job-1")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "View translations" })
    ).toHaveAttribute("href", "/translations");
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });
});
