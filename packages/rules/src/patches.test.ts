import { describe, expect, it } from "vitest";
import type { SessionState, WorldPack } from "@aigame/shared";
import { applyAcceptedPatch, validatePatch } from "./patches";

const pack: WorldPack = {
  manifest: { id: "cave-breakthrough", name: "Cave Breakthrough", version: "0.2.0", runtimeVersion: "0.2.0", entryLocationId: "outer_cave", profileId: "cultivation" },
  worldText: "A quiet cave before a breakthrough.",
  profile: { id: "cultivation", labels: { facts: "玄机" }, quickActions: [], actions: {} },
  rules: {
    allowedPatchTypes: [
      "reveal_fact",
      "add_item",
      "remove_item",
      "move_location",
      "set_flag",
      "adjust_relationship",
      "set_resource",
      "adjust_resource",
      "set_objective_stage"
    ],
    triggers: []
  },
  locations: [
    { id: "outer_cave", name: "Outer Cave", description: "Cold stone.", exits: ["stone_chamber"], visibleObjects: [] },
    { id: "stone_chamber", name: "Stone Chamber", description: "A sealed seat.", exits: [], visibleObjects: [] }
  ],
  characters: [{ id: "mentor_echo", name: "Mentor Echo", publicDescription: "A faint voice.", privateFacts: [], knows: [], forbiddenDisclosures: [], topics: [] }],
  facts: [{ id: "stone_omen", kind: "fact", name: "Stone omen", description: "The wall hums.", discoverableWhen: { location_is: "outer_cave" }, tags: [] }],
  items: [
    { id: "jade_token", name: "Jade token", description: "A smooth token.", pickupCondition: { flag_true: "incense_lit" } }
  ],
  resources: [
    { id: "spiritual_power", name: "Spiritual power", initial: 2, min: 0, max: 10 },
    { id: "heart_demon", name: "Heart demon", initial: 1, min: 0, max: 5 }
  ],
  relationships: [{ characterId: "mentor_echo", name: "Mentor trust", initial: 0, min: -5, max: 5 }],
  objectives: [{ id: "breakthrough", name: "Breakthrough", stages: ["start", "ready"], initialStage: "start" }],
  endings: []
};

const state: SessionState = {
  currentLocationId: "outer_cave",
  turn: 0,
  inventory: [],
  knownFacts: [],
  resources: { spiritual_power: 2, heart_demon: 1 },
  relationships: { mentor_echo: 0 },
  flags: {},
  objectiveStages: { breakthrough: "start" }
};

describe("patch validation", () => {
  it("accepts existing fact reveal", () => {
    expect(validatePatch({ type: "reveal_fact", factId: "stone_omen", reason: "Observed." }, pack, state)).toEqual({ ok: true });
  });

  it("rejects unknown fact reveal", () => {
    expect(validatePatch({ type: "reveal_fact", factId: "invented", reason: "AI guessed." }, pack, state)).toEqual({
      ok: false,
      reason: "Unknown fact: invented"
    });
  });

  it("rejects unknown item pickup and blocked item pickup", () => {
    expect(validatePatch({ type: "add_item", itemId: "invented", reason: "AI guessed." }, pack, state)).toEqual({
      ok: false,
      reason: "Unknown item: invented"
    });
    expect(validatePatch({ type: "add_item", itemId: "jade_token", reason: "Picked up token." }, pack, state)).toEqual({
      ok: false,
      reason: "Item pickup condition failed: jade_token"
    });
  });

  it("rejects unknown relationship and objective targets", () => {
    expect(validatePatch({ type: "adjust_relationship", characterId: "invented", delta: 1, reason: "AI guessed." }, pack, state)).toEqual({
      ok: false,
      reason: "Unknown character: invented"
    });
    expect(validatePatch({ type: "set_objective_stage", objectiveId: "breakthrough", stage: "invented", reason: "AI guessed." }, pack, state)).toEqual({
      ok: false,
      reason: "Unknown objective stage: breakthrough.invented"
    });
  });

  it("rejects unknown and out-of-bounds resources", () => {
    expect(validatePatch({ type: "adjust_resource", resourceId: "invented", delta: 1, reason: "AI guessed." }, pack, state)).toEqual({
      ok: false,
      reason: "Unknown resource: invented"
    });
    expect(validatePatch({ type: "set_resource", resourceId: "spiritual_power", value: 99, reason: "Too much." }, pack, state)).toEqual({
      ok: false,
      reason: "Resource out of bounds: spiritual_power=99"
    });
    expect(validatePatch({ type: "adjust_resource", resourceId: "heart_demon", delta: -2, reason: "Too calm." }, pack, state)).toEqual({
      ok: false,
      reason: "Resource out of bounds: heart_demon=-1"
    });
  });

  it("rejects movement when the destination entry condition is not met", () => {
    const result = validatePatch(
      { type: "move_location", locationId: "stone_chamber", reason: "Walked inward." },
      {
        ...pack,
        locations: [
          { id: "outer_cave", name: "Outer Cave", description: "Cold stone.", exits: ["stone_chamber"], visibleObjects: [] },
          {
            id: "stone_chamber",
            name: "Stone Chamber",
            description: "A sealed seat.",
            exits: [],
            visibleObjects: [],
            entryCondition: { has_item: "jade_token" }
          }
        ]
      },
      state
    );

    expect(result).toEqual({ ok: false, reason: "Location entry condition failed: stone_chamber" });
  });
});

describe("applyAcceptedPatch", () => {
  it("applies generic state patches immutably", () => {
    const withFact = applyAcceptedPatch({ type: "reveal_fact", factId: "stone_omen", reason: "Observed." }, state);
    const withPower = applyAcceptedPatch({ type: "adjust_resource", resourceId: "spiritual_power", delta: 2, reason: "Cultivated." }, state);
    const withCalm = applyAcceptedPatch({ type: "set_resource", resourceId: "heart_demon", value: 0, reason: "Calmed." }, state);
    const withTrust = applyAcceptedPatch({ type: "adjust_relationship", characterId: "mentor_echo", delta: 1, reason: "Listened." }, state);
    const withObjective = applyAcceptedPatch({ type: "set_objective_stage", objectiveId: "breakthrough", stage: "ready", reason: "Prepared." }, state);
    const moved = applyAcceptedPatch({ type: "move_location", locationId: "stone_chamber", reason: "Walked inward." }, state);

    expect(withFact.knownFacts).toEqual(["stone_omen"]);
    expect(withPower.resources.spiritual_power).toBe(4);
    expect(withCalm.resources.heart_demon).toBe(0);
    expect(withTrust.relationships.mentor_echo).toBe(1);
    expect(withObjective.objectiveStages.breakthrough).toBe("ready");
    expect(moved.currentLocationId).toBe("stone_chamber");
    expect(state).toMatchObject({ knownFacts: [], resources: { spiritual_power: 2 }, relationships: { mentor_echo: 0 } });
  });
});
