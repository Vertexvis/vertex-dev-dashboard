import {
  DocumentData,
  ExportData,
  QueuedJobData,
} from "@vertexvis/api-client-node";

import { ErrorRes, GetRes, Res } from "./api";

/** The dashboard deliberately exposes one reviewed export profile, not raw API config. */
export const ExportFormats = ["step"] as const;
export type ExportFormat = (typeof ExportFormats)[number];
export const MinExportDownloadExpirySeconds = 60;
export const MaxExportDownloadExpirySeconds = 24 * 60 * 60;

export interface CreateExportInput {
  readonly sceneId: string;
  readonly sceneViewStateId?: string;
  readonly format: ExportFormat;
  readonly fileName?: string;
  readonly downloadUrlExpiry: number;
}

export interface QueuedExportRes extends Res {
  readonly queuedExportId: string;
  readonly state: "running" | "error" | "complete";
  readonly exportId?: string;
  readonly errors?: string[];
}

export interface ExportRes extends Res {
  readonly id: string;
  readonly created: string;
  readonly downloadUrlExpiry?: number;
  readonly fileId?: string;
}

export interface ExportDownloadUrlRes extends Res {
  readonly url: string;
}

export type DocumentListRes = GetRes<DocumentData>;

export function toExportRes(data: ExportData): ExportRes {
  return {
    created: data.attributes.created,
    downloadUrlExpiry: data.attributes.downloadUrlExpiry,
    fileId: data.relationships?.file.data.id,
    id: data.id,
    status: 200,
  };
}

export function isExportData(value: unknown): value is ExportData {
  const data = value as Partial<ExportData> | undefined;
  return (
    data?.type === "export" &&
    typeof data.id === "string" &&
    typeof data.attributes?.downloadUrl === "string"
  );
}

export function toQueuedExportRes(
  data: QueuedJobData | ExportData,
  queuedExportId: string
): QueuedExportRes {
  if (isExportData(data)) {
    return {
      exportId: data.id,
      queuedExportId,
      state: "complete",
      status: 200,
    };
  }

  const state = data.attributes.status.trim().toLowerCase();
  if (state === "running" || state === "queued" || state === "starting") {
    return { queuedExportId, state: "running", status: 200 };
  }

  const errors = data.attributes.errors
    ? [...data.attributes.errors]
        .map((error) => error.title)
        .filter((title): title is string => typeof title === "string")
    : undefined;
  return { errors, queuedExportId, state: "error", status: 200 };
}

export function parseOpaqueId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const id = value.trim();
  return id === "" || id.length > 200 ? undefined : id;
}

export function parseCreateExportInput(
  value: unknown
): CreateExportInput | ErrorRes {
  if (typeof value !== "object" || value == null || Array.isArray(value)) {
    return { message: "Invalid body.", status: 400 };
  }
  const body = value as Record<string, unknown>;
  const allowed = new Set([
    "sceneId",
    "sceneViewStateId",
    "format",
    "fileName",
    "downloadUrlExpiry",
  ]);
  if (Object.keys(body).some((key) => !allowed.has(key))) {
    return { message: "Invalid body.", status: 400 };
  }
  const sceneId = parseOpaqueId(body.sceneId);
  const stateId =
    body.sceneViewStateId == null
      ? undefined
      : parseOpaqueId(body.sceneViewStateId);
  const format = body.format;
  const fileName = body.fileName;
  const expiry = body.downloadUrlExpiry;
  if (
    sceneId == null ||
    (body.sceneViewStateId != null && stateId == null) ||
    !ExportFormats.includes(format as ExportFormat) ||
    (fileName != null &&
      (typeof fileName !== "string" ||
        fileName.trim() === "" ||
        fileName.length > 200 ||
        /[\\/]/.test(fileName) ||
        fileName.includes(String.fromCharCode(0)))) ||
    typeof expiry !== "number" ||
    !Number.isInteger(expiry) ||
    expiry < MinExportDownloadExpirySeconds ||
    expiry > MaxExportDownloadExpirySeconds
  ) {
    return { message: "Invalid body.", status: 400 };
  }
  return {
    downloadUrlExpiry: expiry,
    fileName: fileName?.trim(),
    format: format as ExportFormat,
    sceneId,
    sceneViewStateId: stateId,
  };
}
