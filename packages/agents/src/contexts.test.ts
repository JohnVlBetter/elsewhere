import { describe, expect, it } from "vitest";
import type { SessionState, WorldPack } from "@aigame/shared";
import { buildCharacterContext, buildNarratorContext } from "./contexts";

const pack: WorldPack = {
  manifest: { id: "cave-breakthrough", name: "Cave Breakthrough", version: "0.2.0", runtimeVersion: "0.2.0", entryLocationId: "outer_cave", profileId: "cultivation" },
  worldText: "A quiet cave before a breakthrough.",
  profile: { id: "cultivation", labels: { facts: "玄机" }, quickActions: [], actions: {} },
  rules: { allowedPatchTypes: ["reveal_fact"], triggers: [] },
  locations: [{ id: "outer_cave", name: "Outer Cave", description: "Cold stone.", exits: [], visibleObjects: ["stone_omen"] }],
  characters: [
    { id: "mentor_echo", name: "Mentor Echo", publicDescription: "A faint voice.", privateFacts: ["private mentor secret"], knows: ["stone_omen"], forbiddenDisclosures: ["private mentor secret"], topics: [] },
    { id: "rival", name: "Rival", publicDescription: "Watching from afar.", privateFacts: ["rival secret"], knows: [], forbiddenDisclosures: [], topics: [] }
  ],
  facts: [{ id: "stone_omen", kind: "fact", name: "石壁灵纹", description: "The wall hums.", discoverableWhen: { location_is: "outer_cave" }, tags: [] }],
  items: [],
  resources: [{ id: "spiritual_power", name: "Spiritual power", initial: 5, min: 0, max: 10 }],
  relationships: [{ characterId: "mentor_echo", name: "Mentor trust", initial: 3, min: -5, max: 5 }],
  objectives: [],
  endings: []
};

const state: SessionState = {
  currentLocationId: "outer_cave",
  turn: 1,
  inventory: [],
  knownFacts: ["stone_omen"],
  resources: { spiritual_power: 5 },
  relationships: { mentor_echo: 3 },
  flags: {},
  objectiveStages: {}
};

describe("agent contexts", () => {
  it("keeps character private facts out of narrator context", () => {
    const context = buildNarratorContext(pack, state, { actionText: "look" });

    expect(context.profile.id).toBe("cultivation");
    expect(context.knownFacts).toEqual([
      expect.objectContaining({ id: "stone_omen", name: "石壁灵纹", description: "The wall hums." })
    ]);
    expect(context.visibleFacts).toEqual(context.knownFacts);
    expect(context.resources).toEqual({ spiritual_power: 5 });
    expect(JSON.stringify(context)).not.toContain("private mentor secret");
    expect(JSON.stringify(context)).not.toContain("rival secret");
  });

  it("scopes character context to one character", () => {
    const context = buildCharacterContext(pack, state, { characterId: "mentor_echo", topic: "breathing" });

    expect(context.character.id).toBe("mentor_echo");
    expect(context.topic).toBe("breathing");
    expect(context.allowedKnownFacts).toEqual(["stone_omen"]);
    expect(context.knownFactDetails).toEqual([
      expect.objectContaining({ id: "stone_omen", name: "石壁灵纹", description: "The wall hums." })
    ]);
    expect(context.relationship).toBe(3);
    expect(JSON.stringify(context)).not.toContain("rival secret");
  });
});
