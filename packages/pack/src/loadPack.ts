import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";
import { WorldPackSchema } from "@aigame/shared";
import type { WorldPack } from "@aigame/shared";

function readRequiredFile(root: string, fileName: string): string {
  const path = join(root, fileName);
  if (!existsSync(path)) {
    throw new Error(`Missing required pack file: ${path}`);
  }
  return readFileSync(path, "utf8");
}

function readYamlFile(root: string, fileName: string): unknown {
  return YAML.parse(readRequiredFile(root, fileName));
}

function readPrompts(root: string): Record<string, string> {
  const promptRoot = join(root, "prompts");
  if (!existsSync(promptRoot)) {
    return {};
  }

  return Object.fromEntries(
    readdirSync(promptRoot)
      .filter((fileName) => fileName.endsWith(".md"))
      .map((fileName) => [
        fileName.replace(/\.md$/, ""),
        readFileSync(join(promptRoot, fileName), "utf8")
      ])
  );
}

export function loadWorldPack(root: string): WorldPack {
  const pack = {
    manifest: readYamlFile(root, "manifest.yaml"),
    worldText: readRequiredFile(root, "world.md"),
    rules: readYamlFile(root, "rules.yaml"),
    locations: readYamlFile(root, "locations.yaml"),
    npcs: readYamlFile(root, "npcs.yaml"),
    clues: readYamlFile(root, "clues.yaml"),
    items: readYamlFile(root, "items.yaml"),
    quests: readYamlFile(root, "quests.yaml"),
    endings: readYamlFile(root, "endings.yaml"),
    prompts: readPrompts(root)
  };

  return WorldPackSchema.parse(pack);
}
