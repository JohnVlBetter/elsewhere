import { lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import type { Manifest } from "@aigame/shared";
import { loadWorldPack } from "./loadPack";
import { validateWorldPack } from "./validatePack";
import type { ValidationResult } from "./validatePack";

export interface PackArchive {
  format: "aigame.pack.v2";
  manifest: Manifest;
  validation: ValidationResult;
  files: Record<string, string>;
}

export interface PackArchiveResult {
  outputPath: string;
  manifest: Manifest;
  validation: ValidationResult;
  fileCount: number;
}

const ROOT_ARCHIVE_FILES = new Set([
  "manifest.yaml",
  "world.md",
  "profile.yaml",
  "rules.yaml",
  "locations.yaml",
  "characters.yaml",
  "facts.yaml",
  "items.yaml",
  "resources.yaml",
  "relationships.yaml",
  "objectives.yaml",
  "endings.yaml"
]);

export function buildPackArchive(packRoot: string, outputPath: string): PackArchiveResult {
  const pack = loadWorldPack(packRoot);
  const validation = validateWorldPack(pack);
  if (!validation.ok) {
    throw new Error(`Pack validation failed:\n${validation.errors.join("\n")}`);
  }

  const files = readPackFiles(packRoot);
  const archive: PackArchive = {
    format: "aigame.pack.v2",
    manifest: pack.manifest,
    validation,
    files
  };

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(archive, null, 2), "utf8");

  return {
    outputPath,
    manifest: pack.manifest,
    validation,
    fileCount: Object.keys(files).length
  };
}

function readPackFiles(packRoot: string): Record<string, string> {
  return Object.fromEntries(
    listFiles(packRoot)
      .sort()
      .flatMap((filePath) => {
        const archivePath = relative(packRoot, filePath).split(sep).join("/");
        if (!isAllowedArchivePath(archivePath)) return [];
        return [[archivePath, readFileSync(filePath, "utf8")]];
      })
  );
}

function listFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) return [];
    if (entry.isDirectory()) {
      return listFiles(path);
    }
    return stat.isFile() ? [path] : [];
  });
}

function isAllowedArchivePath(archivePath: string): boolean {
  if (ROOT_ARCHIVE_FILES.has(archivePath)) return true;
  return archivePath.startsWith("scripts/") && /\.(ya?ml)$/i.test(archivePath);
}
