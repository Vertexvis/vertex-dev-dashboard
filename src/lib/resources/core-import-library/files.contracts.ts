import type {
  CreateFileRequestDataAttributes,
  FileMetadata,
} from "@vertexvis/api-client-node";

import type { Res } from "../../api/contracts";

export type CreateFileReq = CreateFileRequestDataAttributes;
export type FileData = FileMetadata["data"];
export type CreateFileRes = Res & Pick<FileData, "id">;
