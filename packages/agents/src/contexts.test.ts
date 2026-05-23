import { describe, expect, it } from "vitest";
import { SessionState, WorldPack } from "@aigame/shared";
import { buildNpcContext, buildNarratorContext } from "./contexts";

const pack: WorldPack = {
  manifest: { id: "rain-tower", name: "Rain Tower Murder", version: "0.1.0", runtimeVersion: "0.1.0", entryLocationId: "foyer" },
  worldText: "Stormy estate.",
  rules: { allowedPatchTypes: ["discover_clue"] },
  locations: [{ id: "foyer", name: "Foyer", description: "Entry.", exits: [], visibleObjects: [] }],
  npcs: [{ id: "butler", name: "Mr. Vale", publicDescription: "Precise.", privateFacts: ["He reset the bell."], knows: ["The watch stopped early."], forbiddenDisclosures: ["He reset the bell."], topics: [] }],
  clues: [{ id: "broken_watch", name: "Broken Watch", description: "Stopped.", accusationWeight: 2 }],
  items: [],
  quests: [],
  endings: [],
  prompts: {}
};

const state: SessionState = {
  currentLocationId: "foyer",
  turn: 1,
  inventory: [],
  knownClues: ["broken_watch"],
  flags: {},
  npcAttitudes: {},
  questStages: {}
};

describe("agent contexts", () => {
  it("keeps NPC private facts out of narrator context", () => {
    const context = buildNarratorContext(pack, state, { actionText: "look" });
    expect(JSON.stringify(context)).not.toContain("He reset the bell");
  });

  it("scopes NPC context to one NPC", () => {
    const context = buildNpcContext(pack, state, { npcId: "butler", topic: "alibi" });
    expect(context.npc.id).toBe("butler");
    expect(context.allowedKnownClues).toEqual(["broken_watch"]);
  });
});
