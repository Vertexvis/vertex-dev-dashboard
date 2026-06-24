const { createServer } = require("http");
const next = require("next");

const host = process.env.NEXT_TEST_HOST || "127.0.0.1";
const port = Number(process.env.NEXT_TEST_PORT || "0");
const dir = process.env.NEXT_TEST_DIR || process.cwd();
const dev = process.env.NODE_ENV !== "production";
const readyPrefix = "__NEXT_TEST_READY__";

async function main() {
  const app = next({
    dev,
    dir,
    hostname: host,
    port,
  });
  await app.prepare();

  const handle = app.getRequestHandler();
  const server = createServer((req, res) => {
    handle(req, res);
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not determine Next test server port.");
  }

  process.stdout.write(
    `${readyPrefix}${JSON.stringify({ host, port: address.port })}\n`
  );

  const shutdown = () => {
    server.close(() => {
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
