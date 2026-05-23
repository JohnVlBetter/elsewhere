import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadWorldPack } from "./loadPack";

function writeMiniPack(root: string) {
  writeFileSync(join(root, "manifest.yaml"), [
    "id: rain-tower",
    "name: Rain Tower Murder",
    "version: 0.1.0",
    "runtimeVersion: 0.1.0",
    "entryLocationId: foyer"
  ].join("\n"));
  writeFileSync(join(root, "world.md"), "A locked-room mystery.");
  writeFileSync(join(root, "rules.yaml"), "allowedPatchTypes:\n  - discover_clue\n  - set_flag\n");
  writeFileSync(join(root, "locations.yaml"), "- id: foyer\n  name: Foyer\n  description: A cold entry hall.\n  exits: []\n");
  writeFileSync(join(root, "npcs.yaml"), "[]\n");
  writeFileSync(join(root, "clues.yaml"), "[]\n");
  writeFileSync(join(root, "items.yaml"), "[]\n");
  writeFileSync(join(root, "quests.yaml"), "[]\n");
  writeFileSync(join(root, "endings.yaml"), "[]\n");
  mkdirSync(join(root, "prompts"));
  writeFileSync(join(root, "prompts", "narrator.md"), "Narrate only visible facts.");
}

describe("loadWorldPack", () => {
  it("loads a directory world pack", () => {
    const root = mkdtempSync(join(tmpdir(), "pack-"));
    writeMiniPack(root);

    const pack = loadWorldPack(root);

    expect(pack.manifest.id).toBe("rain-tower");
    expect(pack.worldText).toContain("locked-room");
    expect(pack.locations[0]?.id).toBe("foyer");
    expect(pack.prompts.narrator).toContain("visible facts");
  });

  it("reports the missing pack file path", () => {
    const root = mkdtempSync(join(tmpdir(), "pack-"));

    expect(() => loadWorldPack(root)).toThrow(/manifest.yaml/);
  });
});
