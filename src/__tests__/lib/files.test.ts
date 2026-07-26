import { File, isPartEligibleFile } from "../../lib/files";

function makeFile(status?: string): File {
  return {
    created: "2026-07-21T12:00:00Z",
    name: "sample.jt",
    status,
    suppliedId: "supplied-1",
    uploaded: "2026-07-21T12:01:00Z",
    id: "file-1",
  } as unknown as File;
}

describe("isPartEligibleFile", () => {
  it("allows part creation for complete files regardless of extension", () => {
    expect(isPartEligibleFile(makeFile("complete"))).toBe(true);
    expect(
      isPartEligibleFile({ ...makeFile("complete"), name: "sample.xyz" })
    ).toBe(true);
  });

  it("normalizes status casing and surrounding whitespace", () => {
    expect(isPartEligibleFile(makeFile("  Complete  "))).toBe(true);
  });

  it("blocks part creation for files that are not complete", () => {
    expect(isPartEligibleFile(makeFile("pending"))).toBe(false);
    expect(isPartEligibleFile(makeFile("error"))).toBe(false);
    expect(isPartEligibleFile(makeFile("in_progress"))).toBe(false);
    expect(isPartEligibleFile(makeFile(undefined))).toBe(false);
  });
});
