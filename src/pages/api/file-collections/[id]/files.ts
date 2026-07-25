import {
  Cursors,
  FileIdList,
  FileList,
  FileMetadataData,
  getPage,
  logError,
  VertexClient,
  VertexError,
} from "@vertexvis/api-client-node";
import type { AxiosResponse } from "axios";
import { NextApiResponse } from "next";

import {
  BodyRequired,
  ErrorRes,
  GetRes,
  InvalidBody,
  isErrorFailure,
  MethodNotAllowed,
  Res,
  ServerError,
  toErrorRes,
} from "../../../../lib/api";
import {
  type ListQuery,
  type ListQuerySpec,
  parseListQuery,
  toVertexListParams,
} from "../../../../lib/api/query";
import {
  type FileCollectionFileFilters,
  filterFileCollectionFiles,
  getFileCollectionsApi,
} from "../../../../lib/file-collections";
import { getClientFromSession, makeCall } from "../../../../lib/vertex-api";
import withSession, { NextIronRequest } from "../../../../lib/with-session";

const collectionFilesListQuery: ListQuerySpec = {
  defaultPageSize: 10,
  filters: [
    { operation: "contains", requestName: "name", vertexField: "name" },
    { operation: "contains", requestName: "fileId", vertexField: "fileId" },
    {
      operation: "contains",
      requestName: "suppliedId",
      vertexField: "suppliedId",
    },
  ],
};

// Upstream silently ignores `filter[...]` params on this relationship
// endpoint (verified by probe: the identical format works on /files, but here
// it 200s with unfiltered data). Until support ships, filtered requests scan
// the collection's files across pages server-side and filter locally.
const FILTERED_SCAN_PAGE_SIZE = 100;
// Safety cap on the scan: at most this many upstream page fetches
// (10 x 100 = ~1,000 files). If the cap trips, we still return what was
// gathered and mark the response `truncated` so the UI can tell users that
// matches beyond the scanned files are missing; the console.warn below keeps
// the truncation diagnosable server-side. Acceptable only because upstream
// filter support will eventually replace this stand-in.
const FILTERED_SCAN_MAX_PAGES = 10;

export interface CollectionFilesGetRes extends GetRes<FileMetadataData> {
  /**
   * Present (and true) when the filtered scan stopped at its page cap, so
   * matches beyond the scanned files may be missing from every page.
   */
  readonly truncated?: true;
}

export async function handleFileCollectionFiles(
  req: NextIronRequest,
  res: NextApiResponse<CollectionFilesGetRes | Res | ErrorRes>
): Promise<void> {
  if (req.method === "GET") {
    const r = await get(req);
    return res.status(r.status).json(r);
  }

  if (req.method === "POST") {
    const r = await add(req);
    return res.status(r.status).json(r);
  }

  if (req.method === "DELETE") {
    const r = await remove(req);
    return res.status(r.status).json(r);
  }

  return res.status(MethodNotAllowed.status).json(MethodNotAllowed);
}

interface FileMembershipReq {
  readonly fileIds: readonly string[];
}

async function add(req: NextIronRequest): Promise<ErrorRes | Res> {
  const id = getFileCollectionId(req);
  if (id == null)
    return { message: "File Collection ID required.", status: 400 };

  const body = parseFileMembershipReq(req.body);
  if (body == null) return req.body == null ? BodyRequired : InvalidBody;

  try {
    const c = getFileCollectionsApi(await getClientFromSession(req.session));
    const result = await makeCall(() =>
      c.addFileCollectionFiles({
        fileIdList: { data: [...body.fileIds] } satisfies FileIdList,
        id,
      })
    );
    return isErrorFailure(result)
      ? toErrorRes({ failure: result })
      : { status: 200 };
  } catch (error) {
    return toRouteError(error);
  }
}

async function remove(req: NextIronRequest): Promise<ErrorRes | Res> {
  const id = getFileCollectionId(req);
  if (id == null)
    return { message: "File Collection ID required.", status: 400 };

  const body = parseFileMembershipReq(req.body);
  if (body == null) return req.body == null ? BodyRequired : InvalidBody;

  try {
    const c = getFileCollectionsApi(await getClientFromSession(req.session));
    const result = await makeCall(() =>
      c.removeFileCollectionFiles({
        filterFileId: body.fileIds.join(","),
        id,
      })
    );
    return isErrorFailure(result)
      ? toErrorRes({ failure: result })
      : { status: 200 };
  } catch (error) {
    return toRouteError(error);
  }
}

export default withSession(handleFileCollectionFiles);

async function get(
  req: NextIronRequest
): Promise<ErrorRes | CollectionFilesGetRes> {
  try {
    const id = getFileCollectionId(req);
    if (id == null)
      return { message: "File Collection ID required.", status: 400 };

    const query = parseListQuery(req, collectionFilesListQuery);
    if ("message" in query) return query;

    const client = await getClientFromSession(req.session);
    const filters: FileCollectionFileFilters = {
      fileId: query.filters.fileId?.contains,
      name: query.filters.name?.contains,
      suppliedId: query.filters.suppliedId?.contains,
    };

    if (
      filters.fileId == null &&
      filters.name == null &&
      filters.suppliedId == null
    ) {
      // Unfiltered: single upstream page with cursor passthrough.
      const { cursors, page } = await fetchCollectionFilesPage(
        client,
        id,
        toVertexListParams(query, collectionFilesListQuery)
      );
      return { cursors, data: page.data, status: 200 };
    }

    // Filtered: upstream ignores the filter params on this endpoint (see the
    // scan constants above), so matches can live on any page. Scan the
    // collection and apply the stand-in filter over the full gathered set.
    const { files, truncated } = await scanCollectionFilesForFilter(
      client,
      id,
      query
    );
    const matches = filterFileCollectionFiles(files, filters);

    // Paging while filtered: the result set is computed here, not upstream,
    // so upstream cursors no longer identify a position in it. Since the
    // whole match set is already materialized, page it with synthetic offset
    // cursors instead: `self` is this page's offset and `next` the following
    // one, so the UI's cursor-driven next/prev paging works unchanged.
    // Revisit when upstream filtering ships.
    const offset = parseFilteredScanOffset(query.cursor);
    const pageEnd = offset + query.pageSize;
    return {
      cursors: {
        next: pageEnd < matches.length ? String(pageEnd) : undefined,
        self: String(offset),
      },
      data: matches.slice(offset, pageEnd),
      status: 200,
      ...(truncated ? { truncated: true } : {}),
    };
  } catch (error) {
    return toRouteError(error);
  }
}

// The generated SDK request type does not accept filters on this
// relationship yet, so mirror the raw Files list call and forward the filter
// parameters upstream — harmless while ignored, self-healing once the
// service honors them.
function fetchCollectionFilesPage(
  client: VertexClient,
  id: string,
  params: URLSearchParams
): Promise<{ cursors: Cursors; page: FileList }> {
  return getPage(
    () =>
      client.axiosInstance.get(
        `${client.config.basePath}/file-collections/${encodeURIComponent(
          id
        )}/files?${params.toString()}`,
        {
          headers: {
            Accept: "application/vnd.api+json",
            Authorization: `Bearer ${client.token.access_token}`,
          },
        }
      ) as Promise<AxiosResponse<FileList>>
  );
}

interface FilteredScanResult {
  readonly files: FileMetadataData[];
  /** True when the scan stopped at the page cap with pages still unread. */
  readonly truncated: boolean;
}

async function scanCollectionFilesForFilter(
  client: VertexClient,
  id: string,
  query: ListQuery
): Promise<FilteredScanResult> {
  const files: FileMetadataData[] = [];
  const seenFileIds = new Set<string>();
  const seenCursors = new Set<string>();
  let cursor: string | undefined;

  for (let fetches = 0; fetches < FILTERED_SCAN_MAX_PAGES; fetches++) {
    // Scan from the start of the collection (the request's own cursor and
    // page size describe the filtered listing, not this scan).
    const params = toVertexListParams(
      { ...query, cursor, pageSize: FILTERED_SCAN_PAGE_SIZE },
      collectionFilesListQuery
    );
    // Each request depends on the cursor returned by the previous page.
    // eslint-disable-next-line no-await-in-loop
    const { cursors, page } = await fetchCollectionFilesPage(
      client,
      id,
      params
    );
    for (const file of page.data) {
      // Skip repeats so a misbehaving upstream that re-serves a page cannot
      // duplicate rows in the response.
      if (seenFileIds.has(file.id)) continue;
      seenFileIds.add(file.id);
      files.push(file);
    }

    const next = cursors.next;
    if (next == null) return { files, truncated: false };
    // Termination guard: an upstream (or test fixture) that echoes the same
    // cursor back, or cycles through earlier cursors, makes no progress —
    // stop instead of spinning until the page cap.
    if (next === cursor || seenCursors.has(next))
      return { files, truncated: false };
    seenCursors.add(next);
    cursor = next;
  }

  // No repo-wide warn helper exists (`logError` only takes errors), so
  // console.warn stays the server-side diagnostic here.
  console.warn(
    `Filtered scan of file collection ${id} stopped at the ` +
      `${FILTERED_SCAN_MAX_PAGES}-page safety cap (${files.length} files ` +
      `scanned); matches beyond the cap are not returned.`
  );
  return { files, truncated: true };
}

// Filtered responses page with synthetic offset cursors (see get()). Parse
// one back into an offset, treating anything else — including a stale
// upstream cursor from an unfiltered page — as the first page.
function parseFilteredScanOffset(cursor?: string): number {
  if (cursor == null || !/^\d+$/.test(cursor)) return 0;

  const offset = Number.parseInt(cursor, 10);
  return Number.isSafeInteger(offset) ? offset : 0;
}

function getFileCollectionId(req: NextIronRequest): string | undefined {
  const id = req.query.id;
  if (typeof id !== "string") return undefined;

  const normalized = id.trim();
  return normalized === "" ? undefined : normalized;
}

function parseFileMembershipReq(body: unknown): FileMembershipReq | undefined {
  if (body == null) return undefined;

  try {
    const parsed =
      typeof body === "string" ? (JSON.parse(body) as unknown) : body;
    if (typeof parsed !== "object" || parsed == null || Array.isArray(parsed))
      return undefined;

    const fileIds = (parsed as { fileIds?: unknown }).fileIds;
    if (
      !Array.isArray(fileIds) ||
      fileIds.length === 0 ||
      fileIds.some(
        (fileId) => typeof fileId !== "string" || fileId.trim() === ""
      )
    )
      return undefined;

    return { fileIds: [...new Set(fileIds.map((fileId) => fileId.trim()))] };
  } catch {
    return undefined;
  }
}

function toRouteError(error: unknown): ErrorRes {
  const e = error as VertexError;
  logError(e);
  return e.vertexError?.res
    ? toErrorRes({ failure: e.vertexError?.res })
    : ServerError;
}
