import type { NextApiRequest, NextApiResponse } from "next";

const E2E_TOKEN = "e2e-token-not-for-vertex";
const collectionId = "collection-1";
const completeFile = {
  attributes: {
    created: "2026-07-21T12:00:00Z",
    name: "fixture-file.jt",
    status: "complete",
    suppliedId: "fixture-1",
    uploaded: "2026-07-21T12:01:00Z",
  },
  id: "fixture-file-1",
  type: "file",
};
const collection = {
  attributes: {
    created: "2026-07-21T12:00:00Z",
    name: "Fixture collection",
    suppliedId: "fixture-collection",
  },
  id: collectionId,
  type: "file-collection",
};

function enabled(req: NextApiRequest): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.E2E_TEST_MODE === "true" &&
    req.headers.authorization === `Bearer ${E2E_TOKEN}`
  );
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
): void {
  if (!enabled(req)) {
    res.status(404).json({ message: "Not found.", status: 404 });
    return;
  }

  const path = Array.isArray(req.query.path) ? req.query.path.join("/") : "";
  if (path === `file-collections/${collectionId}` && req.method === "GET") {
    res.status(200).json({ data: collection });
    return;
  }
  if (
    path === `file-collections/${collectionId}/files` &&
    (req.method === "GET" || req.method === "POST" || req.method === "DELETE")
  ) {
    res
      .status(200)
      .json(
        req.method === "GET"
          ? { data: [completeFile], links: {} }
          : { data: collection }
      );
    return;
  }
  if (path === "files" && req.method === "GET") {
    res.status(200).json({ data: [completeFile], links: {} });
    return;
  }
  if (
    path === `files/${completeFile.id}/file-collections` &&
    req.method === "GET"
  ) {
    res.status(200).json({ data: [collection], links: {} });
    return;
  }

  res.status(404).json({ message: "Fixture not found.", status: 404 });
}
