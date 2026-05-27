const { spawnSync } = require("node:child_process");
const { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } = require("node:fs");
const path = require("node:path");
const { fileURLToPath } = require("node:url");

const root = process.cwd();
const coverageRoot = path.join(root, ".tmp", `v8-coverage-${Date.now()}-${process.pid}`);
const minimumLineCoverage = Number(process.env.COVERAGE_MIN_LINES ?? "55");

mkdirSync(coverageRoot, { recursive: true });

const result = spawnSync(process.execPath, [
  "--require",
  path.join(root, "scripts", "vite-windows-net-use-shim.cjs"),
  path.join(root, "node_modules", "vitest", "vitest.mjs"),
  "run"
], {
  cwd: root,
  env: { ...process.env, NODE_V8_COVERAGE: coverageRoot },
  stdio: "inherit"
});

if (result.status !== 0) {
  cleanupCoverageRoot();
  process.exit(result.status ?? 1);
}

const sourceFiles = listSourceFiles(root);
const coveredLines = collectCoveredLines(coverageRoot);
let totalExecutableLines = 0;
let totalCoveredLines = 0;

for (const filePath of sourceFiles) {
  const executableLines = findExecutableLines(readFileSync(filePath, "utf8"));
  const covered = coveredLines.get(normalizePath(filePath)) ?? new Set();
  totalExecutableLines += executableLines.size;
  for (const line of executableLines) {
    if (covered.has(line)) totalCoveredLines += 1;
  }
}

const lineCoverage = totalExecutableLines === 0
  ? 100
  : (totalCoveredLines / totalExecutableLines) * 100;

console.log(`V8 line coverage gate: ${lineCoverage.toFixed(2)}% (${totalCoveredLines}/${totalExecutableLines}), minimum ${minimumLineCoverage}%`);
cleanupCoverageRoot();

if (lineCoverage < minimumLineCoverage) {
  process.exit(1);
}

function listSourceFiles(repoRoot) {
  const roots = [
    path.join(repoRoot, "packages"),
    path.join(repoRoot, "apps", "cli", "src"),
    path.join(repoRoot, "apps", "web", "src"),
    path.join(repoRoot, "apps", "web", "app", "api")
  ].filter(existsSync);
  return roots.flatMap((sourceRoot) => walk(sourceRoot))
    .filter((filePath) => /\.(tsx?|mts|cts)$/.test(filePath))
    .filter((filePath) => !/\.test\.tsx?$/.test(filePath))
    .filter((filePath) => !/\.d\.ts$/.test(filePath))
    .filter((filePath) => !filePath.includes(`${path.sep}prompts${path.sep}`));
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") return [];
      return walk(entryPath);
    }
    return entry.isFile() ? [entryPath] : [];
  });
}

function collectCoveredLines(directory) {
  const coverage = new Map();
  for (const filePath of walk(directory)) {
    if (!filePath.endsWith(".json")) continue;
    const payload = JSON.parse(readFileSync(filePath, "utf8"));
    for (const entry of payload.result ?? []) {
      if (typeof entry.url !== "string" || !entry.url.startsWith("file:")) continue;
      const sourcePath = normalizePath(fileURLToPath(entry.url));
      if (!sourcePath.startsWith(normalizePath(root))) continue;
      const covered = coverage.get(sourcePath) ?? new Set();
      const text = safeReadFile(sourcePath);
      if (!text) continue;
      const lineStarts = computeLineStarts(text);
      for (const fn of entry.functions ?? []) {
        for (const range of fn.ranges ?? []) {
          if (range.count <= 0) continue;
          for (const line of linesForRange(lineStarts, range.startOffset, range.endOffset)) {
            covered.add(line);
          }
        }
      }
      coverage.set(sourcePath, covered);
    }
  }
  return coverage;
}

function safeReadFile(filePath) {
  try {
    return readFileSync(filePath, "utf8");
  } catch {
    return undefined;
  }
}

function computeLineStarts(text) {
  const starts = [0];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "\n") starts.push(index + 1);
  }
  return starts;
}

function linesForRange(lineStarts, startOffset, endOffset) {
  const lines = [];
  for (let index = 0; index < lineStarts.length; index += 1) {
    const lineStart = lineStarts[index];
    const nextLineStart = lineStarts[index + 1] ?? Number.POSITIVE_INFINITY;
    if (nextLineStart <= startOffset) continue;
    if (lineStart >= endOffset) break;
    lines.push(index + 1);
  }
  return lines;
}

function findExecutableLines(text) {
  const lines = new Set();
  text.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//") || trimmed === "{" || trimmed === "}") return;
    if (trimmed.startsWith("import ") || trimmed.startsWith("export type ")) return;
    lines.add(index + 1);
  });
  return lines;
}

function normalizePath(filePath) {
  return path.resolve(filePath).replaceAll("\\", "/");
}

function cleanupCoverageRoot() {
  const resolvedCoverageRoot = path.resolve(coverageRoot);
  const resolvedTmp = path.resolve(root, ".tmp");
  if (resolvedCoverageRoot.startsWith(resolvedTmp) && existsSync(resolvedCoverageRoot)) {
    try {
      rmSync(resolvedCoverageRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    } catch {
      // Windows can keep V8 coverage files briefly locked after worker shutdown.
    }
  }
}
