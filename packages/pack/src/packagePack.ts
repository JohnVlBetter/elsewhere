import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
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
        if (archivePath.startsWith("prompts/")) return [];
        return [[archivePath, readFileSync(filePath, "utf8")]];
      })
  );
}

function listFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      return listFiles(path);
    }
    return statSync(path).isFile() ? [path] : [];
  });
}
