import { describe, expect, it } from "vitest";
import { loadWorldPack, validateWorldPack } from "./index";

const packIds = ["campus-lunch", "cave-breakthrough", "rain-tower", "ember-crypt", "mist-sect", "spring-festival"];

describe("sample packs", () => {
  it("loads and validates every generic genre pack", () => {
    for (const packId of packIds) {
      const pack = loadWorldPack(`packs/${packId}`);
      const result = validateWorldPack(pack);

      expect(result.errors, packId).toEqual([]);
    }
  });

  it("covers small, medium, and large non-detective shapes", () => {
    expect(loadWorldPack("packs/campus-lunch").manifest.profileId).toBe("romance");
    expect(loadWorldPack("packs/cave-breakthrough").resources.length).toBeGreaterThanOrEqual(2);
    expect(loadWorldPack("packs/rain-tower").facts).toHaveLength(6);
    expect(loadWorldPack("packs/ember-crypt").resources.map((resource) => resource.id).sort()).toEqual(["gold", "hp", "spell_slot"]);
    expect(loadWorldPack("packs/mist-sect").locations.length).toBeGreaterThanOrEqual(6);
    expect(loadWorldPack("packs/spring-festival").relationships.length).toBeGreaterThanOrEqual(5);
  });
});
