import { render, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import React from "react";

import { installJsdomMockServer } from "../../../../test/msw/installJsdomMockServer";
import { server } from "../../../../test/msw/server";
import { FileDetailsDrawer } from "../../../components/file/FileDetailsDrawer";
import { File } from "../../../lib/files";

describe("FileDetailsDrawer", () => {
  installJsdomMockServer();

  it("reloads reverse collection memberships when the membership version changes", async () => {
    const listMemberships = jest.fn(() =>
      HttpResponse.json({ cursors: { self: "page-1" }, data: [], status: 200 })
    );
    server.use(
      http.get("*/api/files/file-1/file-collections", (info) =>
        listMemberships(info)
      )
    );

    const { rerender } = render(
      <FileDetailsDrawer
        file={file()}
        membershipVersion={0}
        onClose={jest.fn()}
        open
      />
    );

    await waitFor(() => expect(listMemberships).toHaveBeenCalledTimes(1));
    expect(
      new URL(listMemberships.mock.calls[0][0].request.url).searchParams.get(
        "pageSize"
      )
    ).toBe("25");

    rerender(
      <FileDetailsDrawer
        file={file()}
        membershipVersion={1}
        onClose={jest.fn()}
        open
      />
    );

    await waitFor(() => expect(listMemberships).toHaveBeenCalledTimes(2));
  });
});

function file(): File {
  return {
    created: "2026-06-12T15:30:00Z",
    id: "file-1",
    name: "File One",
    status: "complete",
  } as File;
}
