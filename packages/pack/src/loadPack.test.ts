import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadWorldPack } from "./loadPack";

function writeMiniPack(root: string) {
  writeFileSync(join(root, "manifest.yaml"), [
    "id: campus-lunch",
    "name: Campus Lunch",
    "version: 0.2.0",
    "runtimeVersion: 0.2.0",
    "entryLocationId: classroom",
    "profileId: romance"
  ].join("\n"));
  writeFileSync(join(root, "world.md"), "A lunch-break misunderstanding.");
  writeFileSync(join(root, "profile.yaml"), [
    "id: romance",
    "labels:",
    "  facts: 回忆",
    "quickActions: []",
    "actions: {}"
  ].join("\n"));
  writeFileSync(join(root, "rules.yaml"), "allowedPatchTypes:\n  - reveal_fact\ntriggers: []\n");
  writeFileSync(join(root, "locations.yaml"), "- id: classroom\n  name: Classroom\n  description: Lunch is about to start.\n  exits: []\n");
  writeFileSync(join(root, "characters.yaml"), "[]\n");
  writeFileSync(join(root, "facts.yaml"), "[]\n");
  writeFileSync(join(root, "items.yaml"), "[]\n");
  writeFileSync(join(root, "resources.yaml"), "[]\n");
  writeFileSync(join(root, "relationships.yaml"), "[]\n");
  writeFileSync(join(root, "objectives.yaml"), "[]\n");
  writeFileSync(join(root, "endings.yaml"), "[]\n");
  mkdirSync(join(root, "prompts"));
  writeFileSync(join(root, "prompts", "narrator.md"), "Narrate only visible facts.");
}

describe("loadWorldPack", () => {
  it("loads a v0.2 directory world pack without exposing prompt overrides", () => {
    const root = mkdtempSync(join(tmpdir(), "pack-"));
    writeMiniPack(root);

    const pack = loadWorldPack(root);

    expect(pack.manifest.id).toBe("campus-lunch");
    expect(pack.manifest.profileId).toBe("romance");
    expect(pack.profile.id).toBe("romance");
    expect(pack.worldText).toContain("lunch-break");
    expect(pack.locations[0]?.id).toBe("classroom");
    expect("prompts" in pack).toBe(false);
  });

  it("reports the missing pack file path", () => {
    const root = mkdtempSync(join(tmpdir(), "pack-"));

    expect(() => loadWorldPack(root)).toThrow(/manifest.yaml/);
  });
});
