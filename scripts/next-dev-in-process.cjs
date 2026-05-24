const path = require("node:path");
const { startServer } = require("next/dist/server/lib/start-server");

function readOption(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return fallback;
  }
  return process.argv[index + 1] ?? fallback;
}

const port = Number.parseInt(readOption("--port", process.env.PORT ?? "3000"), 10);
const hostname = readOption("--hostname", "127.0.0.1");

process.env.NEXT_PRIVATE_START_TIME = Date.now().toString();
process.env.__NEXT_DEV_SERVER = "true";

startServer({
  dir: path.resolve("apps/web"),
  port,
  hostname,
  isDev: true,
  allowRetry: false
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
