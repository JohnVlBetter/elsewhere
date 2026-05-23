import { describe, expect, it } from "vitest";
import { WorldPack } from "@aigame/shared";
import { validateWorldPack } from "./validatePack";

function basePack(): WorldPack {
  return {
    manifest: {
      id: "rain-tower",
      name: "Rain Tower Murder",
      version: "0.1.0",
      runtimeVersion: "0.1.0",
      entryLocationId: "foyer"
    },
    worldText: "A mystery.",
    rules: { allowedPatchTypes: ["discover_clue", "set_flag"] },
    locations: [{ id: "foyer", name: "Foyer", description: "Entry.", exits: [], visibleObjects: [] }],
    npcs: [{ id: "butler", name: "Butler", publicDescription: "Formal.", privateFacts: [], knows: [], forbiddenDisclosures: [], topics: [] }],
    clues: [{ id: "broken_watch", name: "Broken watch", description: "Stopped at nine.", accusationWeight: 2 }],
    items: [],
    quests: [{ id: "solve_murder", name: "Solve murder", stages: ["investigate", "accuse"], initialStage: "investigate" }],
    endings: [{ id: "unresolved_failure", name: "Unresolved", priority: 0, condition: { flag_true: "case_failed" }, text: "The case goes cold." }],
    prompts: {}
  };
}

describe("validateWorldPack", () => {
  it("accepts a coherent pack", () => {
    const result = validateWorldPack(basePack());

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("reports missing entry location", () => {
    const pack = basePack();
    pack.manifest.entryLocationId = "missing";

    const result = validateWorldPack(pack);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Entry location not found: missing");
  });

  it("reports broken location exits", () => {
    const pack = basePack();
    pack.locations[0]!.exits = ["study"];

    const result = validateWorldPack(pack);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Location foyer exits to missing location: study");
  });

  it("reports NPC topic clue references", () => {
    const pack = basePack();
    pack.locations[0]!.exits = [];
    pack.npcs[0]!.topics = [{ id: "alibi", prompt: "Ask alibi.", revealsClueId: "missing_clue" }];

    const result = validateWorldPack(pack);

    expect(result.errors).toContain("NPC butler topic alibi reveals missing clue: missing_clue");
  });
});
