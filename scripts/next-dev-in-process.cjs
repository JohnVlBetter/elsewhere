const fs = require("node:fs");
const path = require("node:path");
const { startServer } = require("next/dist/server/lib/start-server");

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const splitAt = line.indexOf("=");
    if (splitAt <= 0) continue;
    const name = line.slice(0, splitAt).trim();
    let value = line.slice(splitAt + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[name] = value;
  }
}

function configureDevRuntimeDefaults(env = process.env) {
  if (env.AIGAME_MODEL_PROVIDER || env.DEEPSEEK_API_KEY || env.OPENAI_COMPATIBLE_API_KEY) return;
  env.AIGAME_MODEL_PROVIDER = "fake";
}

function readOption(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return fallback;
  }
  return process.argv[index + 1] ?? fallback;
}

const port = Number.parseInt(readOption("--port", process.env.PORT ?? "3000"), 10);
const hostname = readOption("--hostname", "127.0.0.1");

loadDotEnv(path.resolve(".env.local"));
configureDevRuntimeDefaults(process.env);

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
