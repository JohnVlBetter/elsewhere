import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { listWorldPackSummaries } from "./listPacks";

async function writePack(root: string, id: string, name: string, worldText: string) {
  const packRoot = join(root, id);
  await mkdir(packRoot);
  await writeFile(join(packRoot, "manifest.yaml"), [
    `id: ${id}`,
    `name: ${name}`,
    "version: 0.2.0",
    "runtimeVersion: 0.2.0",
    "entryLocationId: foyer",
    "profileId: detective"
  ].join("\n"));
  await writeFile(join(packRoot, "world.md"), worldText);
  await writeFile(join(packRoot, "profile.yaml"), [
    "id: detective",
    "labels: {}",
    "theme:",
    "  tone: cool",
    "  accentColor: '#4f8cff'",
    "assets:",
    "  coverImage: generated/covers/rain-tower.webp",
    "  bannerImage: generated/banners/rain-tower.webp",
    "quickActions: []",
    "actions: {}"
  ].join("\n"));
  await writeFile(join(packRoot, "rules.yaml"), "allowedPatchTypes:\n  - reveal_fact\ntriggers: []\n");
  await writeFile(join(packRoot, "locations.yaml"), "- id: foyer\n  name: Foyer\n  description: Entry.\n  exits: []\n");
  await writeFile(join(packRoot, "characters.yaml"), "[]\n");
  await writeFile(join(packRoot, "facts.yaml"), "[]\n");
  await writeFile(join(packRoot, "items.yaml"), "[]\n");
  await writeFile(join(packRoot, "resources.yaml"), "[]\n");
  await writeFile(join(packRoot, "relationships.yaml"), "[]\n");
  await writeFile(join(packRoot, "objectives.yaml"), "[]\n");
  await writeFile(join(packRoot, "endings.yaml"), "[]\n");
}

describe("listWorldPackSummaries", () => {
  it("lists world pack summaries from directories", async () => {
    const root = await mkdtemp(join(tmpdir(), "packs-"));
    try {
      await writePack(root, "rain-tower", "Rain Tower", "# Rain Tower\n\nA stormy tower mystery.");

      await expect(listWorldPackSummaries(root)).resolves.toEqual([
        {
          id: "rain-tower",
          title: "Rain Tower",
          subtitle: "detective",
          introduction: "A stormy tower mystery.",
          version: "0.2.0",
          theme: {
            tone: "cool",
            accentColor: "#4f8cff"
          },
          assets: {
            coverImage: "generated/covers/rain-tower.webp",
            bannerImage: "generated/banners/rain-tower.webp"
          }
        }
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
