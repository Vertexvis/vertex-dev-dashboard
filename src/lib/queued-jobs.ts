import {
  QueuedJobData,
  QueuedJobDataAttributes,
} from "@vertexvis/api-client-node";

import { GetRes } from "./api";
import { Paged, toPage } from "./paging";

export type QueuedJob = Pick<QueuedJobData, "id"> & QueuedJobDataAttributes;

export function toQueuedJobPage(res: GetRes<QueuedJobData>): Paged<QueuedJob> {
  return toPage<QueuedJobData, QueuedJobDataAttributes>(res);
}
