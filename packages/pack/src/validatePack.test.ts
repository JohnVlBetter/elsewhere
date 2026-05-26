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
    endings: [{ id: "unresolved_failure", name: "Unresolved", priority: 0, condition: { flag_true: "case_failed" }, text: "The case goes cold." }]
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

  it("reports invalid condition references across pack entities", () => {
    const pack = basePack();
    pack.locations[0]!.entryCondition = { has_item: "missing_key" };
    pack.npcs[0]!.topics = [
      { id: "secret", prompt: "Ask secret.", unlockCondition: { knows_clue: "missing_clue" } }
    ];
    pack.clues[0]!.discoverableWhen = { location_is: "missing_location" };
    pack.items = [
      {
        id: "greenhouse_key",
        name: "Greenhouse key",
        description: "A brass key.",
        pickupCondition: { npc_attitude_at_least: { npc: "missing_npc", value: 1 } }
      }
    ];
    pack.endings[0]!.condition = { quest_stage_is: { quest: "solve_murder", stage: "missing_stage" } };

    const result = validateWorldPack(pack);

    expect(result.errors).toContain("Location foyer entryCondition references missing item: missing_key");
    expect(result.errors).toContain("NPC butler topic secret unlockCondition references missing clue: missing_clue");
    expect(result.errors).toContain("Clue broken_watch discoverableWhen references missing location: missing_location");
    expect(result.errors).toContain("Item greenhouse_key pickupCondition references missing NPC: missing_npc");
    expect(result.errors).toContain("Ending unresolved_failure condition references missing quest stage: solve_murder.missing_stage");
  });
});
