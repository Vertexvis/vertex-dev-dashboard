import "@testing-library/jest-dom";
import { Blob } from "node:buffer";
import { clearImmediate, setImmediate } from "node:timers";
import { TextDecoder, TextEncoder } from "node:util";
import {
  ReadableStream,
  TransformStream,
  WritableStream,
} from "node:stream/web";
import { BroadcastChannel } from "node:worker_threads";

// MSW 2 relies on Fetch/Web Stream APIs that Jest's jsdom environment
// does not provide consistently. Install them once here for client-side tests.
Object.assign(globalThis, {
  Blob,
  BroadcastChannel,
  clearImmediate,
  ReadableStream,
  setImmediate,
  TextDecoder,
  TextEncoder,
  TransformStream,
  WritableStream,
});

const { File, FormData, Headers, Request, Response, fetch } = require("undici");

Object.assign(globalThis, {
  File,
  FormData,
  Headers,
  Request,
  Response,
  fetch,
});

const performanceWithResourceTiming = performance as Performance & {
  markResourceTiming?: () => void;
};

if (typeof performanceWithResourceTiming.markResourceTiming !== "function") {
  Object.assign(performanceWithResourceTiming, {
    markResourceTiming: () => undefined,
  });
}
