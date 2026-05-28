const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");
const pidPath = path.join(repoRoot, ".tmp", "web-dev.pid");
const port = Number(readOption("--port", "3000"));

const pids = new Set();
const recordedPid = readRecordedPid();
if (recordedPid) pids.add(recordedPid);
for (const pid of findPortListenerPids(port)) pids.add(pid);

if (pids.size === 0) {
  console.log(`No web dev server found on port ${port}.`);
  process.exit(0);
}

for (const pid of pids) {
  stopPid(pid);
}

try {
  fs.rmSync(pidPath, { force: true });
} catch {
  // The next foreground dev start can overwrite this file.
}

console.log(`Stopped web dev server process(es): ${[...pids].join(", ")}`);

function readOption(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1] ?? fallback;
}

function readRecordedPid() {
  if (!fs.existsSync(pidPath)) return undefined;
  const pid = Number(fs.readFileSync(pidPath, "utf8").trim());
  return Number.isInteger(pid) && pid > 0 ? pid : undefined;
}

function findPortListenerPids(targetPort) {
  const result = spawnSync("netstat.exe", ["-ano", "-p", "tcp"], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 3000
  });
  if (result.status !== 0) return [];

  const pids = [];
  for (const line of result.stdout.split(/\r?\n/)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 5 || parts[0] !== "TCP" || parts[3] !== "LISTENING") continue;
    if (!parts[1].endsWith(`:${targetPort}`)) continue;
    const pid = Number(parts[4]);
    if (Number.isInteger(pid) && pid > 0) pids.push(pid);
  }
  return [...new Set(pids)];
}

function stopPid(pid) {
  const result = spawnSync("taskkill.exe", ["/PID", String(pid), "/T", "/F"], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 5000
  });
  if (result.status === 0) return;

  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  throw new Error(`Failed to stop PID ${pid}: ${output || result.error?.message || `exit ${result.status}`}`);
}
