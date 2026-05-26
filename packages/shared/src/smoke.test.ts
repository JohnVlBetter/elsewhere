import { describe, expect, it } from "vitest";
import { ManifestSchema } from "./index";

describe("workspace", () => {
  it("loads TypeScript workspace modules", () => {
    const manifest = ManifestSchema.parse({
      id: "rain-tower",
      name: "Rain Tower Mystery",
      version: "0.2.0",
      runtimeVersion: "0.2.0",
      entryLocationId: "foyer",
      profileId: "detective"
    });

    expect(manifest.id).toBe("rain-tower");
  });
});
