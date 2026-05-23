import { describe, expect, it } from "vitest";
import { loadWorldPack, validateWorldPack } from "./index";

describe("rain-tower sample pack", () => {
  it("loads and validates", () => {
    const pack = loadWorldPack("packs/rain-tower");
    const result = validateWorldPack(pack);

    expect(pack.manifest.id).toBe("rain-tower");
    expect(pack.locations).toHaveLength(3);
    expect(pack.npcs).toHaveLength(3);
    expect(pack.clues).toHaveLength(6);
    expect(pack.items).toHaveLength(2);
    expect(pack.endings.map((ending) => ending.id).sort()).toEqual([
      "true_resolution",
      "unresolved_failure",
      "wrong_accusation"
    ]);
    expect(result.errors).toEqual([]);
  });
});
