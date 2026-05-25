import { describe, expect, it } from "vitest";
import { SessionState, WorldPack } from "@aigame/shared";
import { applyAcceptedPatch, validatePatch } from "./patches";

const pack: WorldPack = {
  manifest: { id: "rain-tower", name: "Rain Tower Murder", version: "0.1.0", runtimeVersion: "0.1.0", entryLocationId: "foyer" },
  worldText: "",
  rules: { allowedPatchTypes: ["discover_clue", "add_item", "move_location", "set_flag"] },
  locations: [{ id: "foyer", name: "Foyer", description: "Entry.", exits: ["study"], visibleObjects: [] }, { id: "study", name: "Study", description: "Books.", exits: [], visibleObjects: [] }],
  npcs: [],
  clues: [{ id: "broken_watch", name: "Broken watch", description: "Stopped.", accusationWeight: 2 }],
  items: [
    { id: "greenhouse_key", name: "Greenhouse key", description: "A brass key.", pickupCondition: { flag_true: "gardener_trusts_player" } }
  ],
  quests: [],
  endings: [],
  prompts: {}
};

const state: SessionState = {
  currentLocationId: "foyer",
  turn: 0,
  inventory: [],
  knownClues: [],
  flags: {},
  npcAttitudes: {},
  questStages: {}
};

describe("patch validation", () => {
  it("accepts existing clue discovery", () => {
    const result = validatePatch({ type: "discover_clue", clueId: "broken_watch", reason: "Found on desk." }, pack, state);
    expect(result.ok).toBe(true);
  });

  it("rejects unknown clue discovery", () => {
    const result = validatePatch({ type: "discover_clue", clueId: "invented", reason: "AI guessed." }, pack, state);
    expect(result).toEqual({ ok: false, reason: "Unknown clue: invented" });
  });

  it("rejects unknown item pickup", () => {
    const result = validatePatch({ type: "add_item", itemId: "invented", reason: "AI guessed." }, pack, state);
    expect(result).toEqual({ ok: false, reason: "Unknown item: invented" });
  });

  it("rejects item pickup when its pickup condition is not met", () => {
    const result = validatePatch({ type: "add_item", itemId: "greenhouse_key", reason: "Picked up key." }, pack, state);
    expect(result).toEqual({ ok: false, reason: "Item pickup condition failed: greenhouse_key" });
  });

  it("moves only to valid connected locations", () => {
    const moved = applyAcceptedPatch({ type: "move_location", locationId: "study", reason: "Walked east." }, state);
    expect(moved.currentLocationId).toBe("study");
  });
});
