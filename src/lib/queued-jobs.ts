import {
  QueuedJobData,
  QueuedJobDataAttributes,
  QueuedTranslationJob,
} from "@vertexvis/api-client-node";

import { GetRes, Res } from "./api";
import { Paged, toPage } from "./paging";

export type QueuedJob = Pick<QueuedJobData, "id"> & QueuedJobDataAttributes;

export interface QueuedTranslationJobRes extends Res {
  readonly data: QueuedTranslationJob["data"];
  readonly included?: NonNullable<QueuedTranslationJob["included"]>;
  readonly links?: NonNullable<QueuedTranslationJob["links"]>;
}

export function toQueuedJobPage(res: GetRes<QueuedJobData>): Paged<QueuedJob> {
  return toPage<QueuedJobData, QueuedJobDataAttributes>(res);
}

export function toQueuedTranslationJobRes(
  job: QueuedTranslationJob,
  status = 200
): QueuedTranslationJobRes {
  return {
    ...(job.included == null ? {} : { included: job.included }),
    ...(job.links == null ? {} : { links: job.links }),
    data: job.data,
    status,
  };
}
