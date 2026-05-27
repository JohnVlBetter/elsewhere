import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { loadWorldPack } from "./loadPack";

export type WorldPackSummary = {
  id: string;
  title: string;
  subtitle: string;
  introduction: string;
  version: string;
};

export async function listWorldPackSummaries(root = "packs"): Promise<WorldPackSummary[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const summaries = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const pack = loadWorldPack(join(root, entry.name));
        return {
          id: entry.name,
          title: pack.manifest.name,
          subtitle: pack.profile.id,
          introduction: summarizeWorldText(pack.worldText),
          version: pack.manifest.version
        };
      })
  );

  return summaries.sort((left, right) => left.title.localeCompare(right.title, "zh-Hans-CN"));
}

function summarizeWorldText(worldText: string): string {
  return worldText
    .replace(/^# .+$/m, "")
    .replace(/\s+/g, " ")
    .trim();
}
