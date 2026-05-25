import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildPackArchive } from "./packagePack";

describe("pack archive builder", () => {
  it("writes an aipack artifact with manifest, validation report, and source files", () => {
    const outputPath = join(mkdtempSync(join(tmpdir(), "aipack-")), "rain-tower.aipack");

    const result = buildPackArchive("packs/rain-tower", outputPath);
    const archive = JSON.parse(readFileSync(outputPath, "utf8")) as {
      format: string;
      manifest: { id: string; name: string };
      validation: { ok: boolean; errors: string[] };
      files: Record<string, string>;
    };

    expect(result.manifest.id).toBe("rain-tower");
    expect(result.validation).toEqual({ ok: true, errors: [] });
    expect(archive.format).toBe("aigame.pack.v1");
    expect(archive.manifest.name).toBe("Rain Tower Murder");
    expect(archive.validation.ok).toBe(true);
    expect(archive.files["manifest.yaml"]).toContain("id: rain-tower");
    expect(archive.files["prompts/language.md"]).toContain("默认使用简体中文");
    expect(archive.files["prompts/narrator.md"]).toContain("只描述玩家当前能够感知到的内容");
  });
});
