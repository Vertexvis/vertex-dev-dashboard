import { FileList } from "@vertexvis/api-client-node";

import { GetRes } from "./api";
import { Paged, toPage } from "./paging";

export type File = FileList["data"][number]["attributes"] &
  Pick<FileList["data"][number], "id">;

export function toFilePage(res: GetRes<FileList["data"][number]>): Paged<File> {
  return toPage<FileList["data"][number], FileList["data"][number]["attributes"]>(
    res
  );
}
