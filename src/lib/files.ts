import { GetFilesRes } from "../pages/api/files";

export interface File {
  readonly created?: string;
  readonly id: string;
  readonly name?: string;
  readonly suppliedId?: string;
  readonly status: string;
  readonly uploaded?: string;
}

export interface Paged<T> {
  cursor: string | null; // Must use null for proper NextJS serialization
  items: T[];
}

export function toFileData(res: GetFilesRes): Paged<File> {
  return {
    cursor: res.cursor ?? null,
    items: res.data.map((i) => ({
      created: i.attributes.created,
      id: i.id,
      name: i.attributes.name,
      suppliedId: i.attributes.suppliedId,
      status: i.attributes.status,
      uploaded: i.attributes.uploaded
    })),
  };
}
