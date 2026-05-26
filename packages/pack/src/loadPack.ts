import { existsSync, readFileSync } from "node:fs";
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

export function loadWorldPack(root: string): WorldPack {
  const pack = {
    manifest: readYamlFile(root, "manifest.yaml"),
    worldText: readRequiredFile(root, "world.md"),
    profile: readYamlFile(root, "profile.yaml"),
    rules: readYamlFile(root, "rules.yaml"),
    locations: readYamlFile(root, "locations.yaml"),
    characters: readYamlFile(root, "characters.yaml"),
    facts: readYamlFile(root, "facts.yaml"),
    items: readYamlFile(root, "items.yaml"),
    resources: readYamlFile(root, "resources.yaml"),
    relationships: readYamlFile(root, "relationships.yaml"),
    objectives: readYamlFile(root, "objectives.yaml"),
    endings: readYamlFile(root, "endings.yaml")
  };

  return WorldPackSchema.parse(pack);
}
