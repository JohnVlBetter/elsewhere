import { describe, expect, it } from "vitest";
import type { GameAction, SessionState, WorldPack } from "@aigame/shared";
import { deriveTriggerPatches } from "./triggers";

const pack: WorldPack = {
  manifest: { id: "rain-tower", name: "Rain Tower", version: "0.2.0", runtimeVersion: "0.2.0", entryLocationId: "foyer", profileId: "detective" },
  worldText: "A storm-bound tower.",
  profile: { id: "detective", labels: { facts: "线索" }, quickActions: [], actions: { confront: { aliases: ["confront"], requiresTarget: "character", acceptsFacts: true } } },
  rules: {
    allowedPatchTypes: ["set_flag"],
    triggers: [
      {
        id: "confront_true_culprit",
        on: { action: "act", intent: "confront", targetId: "butler" },
        when: {
          all: [
            { knows_fact: "broken_watch" },
            { knows_fact: "muddy_bootprint" },
            { knows_fact: "tower_bell_record" }
          ]
        },
        patches: [{ type: "set_flag", flag: "accused_butler", value: true, reason: "Required facts matched." }]
      },
      {
        id: "wrong_confrontation",
        on: { action: "act", intent: "confront" },
        when: {
          not: {
            all: [
              { knows_fact: "broken_watch" },
              { knows_fact: "muddy_bootprint" },
              { knows_fact: "tower_bell_record" }
            ]
          }
        },
        patches: [{ type: "set_flag", flag: "wrong_confrontation", value: true, reason: "Facts were insufficient." }]
      }
    ]
  },
  locations: [{ id: "foyer", name: "Foyer", description: "Entry.", exits: [], visibleObjects: [] }],
  characters: [{ id: "butler", name: "Butler", publicDescription: "Still.", privateFacts: [], knows: [], forbiddenDisclosures: [], topics: [] }],
  facts: [
    { id: "broken_watch", kind: "fact", name: "Broken Watch", description: "Stopped.", tags: [] },
    { id: "muddy_bootprint", kind: "fact", name: "Muddy Bootprint", description: "Narrow.", tags: [] },
    { id: "tower_bell_record", kind: "fact", name: "Bell Record", description: "Reset.", tags: [] }
  ],
  items: [],
  resources: [],
  relationships: [],
  objectives: [],
  endings: []
};

const fullEvidenceState: SessionState = {
  currentLocationId: "foyer",
  turn: 1,
  inventory: [],
  knownFacts: ["broken_watch", "muddy_bootprint", "tower_bell_record"],
  resources: {},
  relationships: {},
  flags: {},
  objectiveStages: {}
};

describe("deriveTriggerPatches", () => {
  it("derives true confrontation patches from pack triggers", () => {
    const action: GameAction = { type: "act", intent: "confront", targetId: "butler", factIds: ["broken_watch"], rawText: "confront" };

    expect(deriveTriggerPatches(pack, fullEvidenceState, action)).toEqual([
      { type: "set_flag", flag: "accused_butler", value: true, reason: "Required facts matched." }
    ]);
  });

  it("derives wrong confrontation patches when conditions match", () => {
    const action: GameAction = { type: "act", intent: "confront", targetId: "heiress", factIds: ["broken_watch"], rawText: "confront" };
    const state = { ...fullEvidenceState, knownFacts: ["broken_watch"] };

    expect(deriveTriggerPatches(pack, state, action)).toEqual([
      { type: "set_flag", flag: "wrong_confrontation", value: true, reason: "Facts were insufficient." }
    ]);
  });

  it("does not derive patches for unrelated actions", () => {
    expect(deriveTriggerPatches(pack, fullEvidenceState, { type: "look", rawText: "look" })).toEqual([]);
  });
});
