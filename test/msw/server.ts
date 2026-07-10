import { setupServer } from "msw/node";

export const nodeMswServer = setupServer();
export const server = nodeMswServer;
