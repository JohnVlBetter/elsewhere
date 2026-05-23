import { describe, expect, it } from "vitest";
import { ManifestSchema } from "./index";

describe("workspace", () => {
  it("loads TypeScript workspace modules", () => {
    const manifest = ManifestSchema.parse({
      id: "rain-tower",
      name: "Rain Tower Murder",
      version: "0.1.0",
      runtimeVersion: "0.1.0",
      entryLocationId: "foyer"
    });

    expect(manifest.id).toBe("rain-tower");
  });
});
