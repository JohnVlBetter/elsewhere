import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildPackArchive } from "./packagePack";

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
  writeFileSync(join(root, "profile.yaml"), "id: romance\nlabels: {}\nquickActions: []\nactions: {}\n");
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
  writeFileSync(join(root, "prompts", "narrator.md"), "Pack prompt override.");
}

describe("pack archive builder", () => {
  it("writes a v2 aipack artifact with manifest, validation report, and source files", () => {
    const root = mkdtempSync(join(tmpdir(), "pack-"));
    const outputPath = join(mkdtempSync(join(tmpdir(), "aipack-")), "campus-lunch.aipack");
    writeMiniPack(root);

    const result = buildPackArchive(root, outputPath);
    const archive = JSON.parse(readFileSync(outputPath, "utf8")) as {
      format: string;
      manifest: { id: string; name: string };
      validation: { ok: boolean; errors: string[] };
      files: Record<string, string>;
    };

    expect(result.manifest.id).toBe("campus-lunch");
    expect(result.validation).toEqual({ ok: true, errors: [] });
    expect(archive.format).toBe("aigame.pack.v2");
    expect(archive.manifest.name).toBe("Campus Lunch");
    expect(archive.validation.ok).toBe(true);
    expect(archive.files["manifest.yaml"]).toContain("id: campus-lunch");
    expect(archive.files["profile.yaml"]).toContain("id: romance");
    expect(archive.files["prompts/narrator.md"]).toBeUndefined();
  });

  it("does not archive arbitrary local files from a pack directory", () => {
    const root = mkdtempSync(join(tmpdir(), "pack-"));
    const outputPath = join(mkdtempSync(join(tmpdir(), "aipack-")), "campus-lunch.aipack");
    writeMiniPack(root);
    writeFileSync(join(root, ".env.local"), "SECRET=do-not-package");
    writeFileSync(join(root, "notes.txt"), "private author notes");

    buildPackArchive(root, outputPath);
    const archive = JSON.parse(readFileSync(outputPath, "utf8")) as {
      files: Record<string, string>;
    };

    expect(archive.files[".env.local"]).toBeUndefined();
    expect(archive.files["notes.txt"]).toBeUndefined();
  });
});
