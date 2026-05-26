import { describe, expect, it } from "vitest";
import type { WorldPack } from "@aigame/shared";
import { validateWorldPack } from "./validatePack";

function basePack(): WorldPack {
  return {
    manifest: {
      id: "rain-tower",
      name: "Rain Tower",
      version: "0.2.0",
      runtimeVersion: "0.2.0",
      entryLocationId: "foyer",
      profileId: "detective"
    },
    worldText: "A storm-bound tower.",
    profile: {
      id: "detective",
      labels: { facts: "线索" },
      quickActions: [],
      actions: { confront: { aliases: ["confront"], requiresTarget: "character", acceptsFacts: true } }
    },
    rules: {
      allowedPatchTypes: ["reveal_fact", "set_flag", "adjust_resource", "set_objective_stage"],
      triggers: [
        {
          id: "confront_true_culprit",
          on: { action: "act", intent: "confront", targetId: "butler" },
          when: { knows_fact: "broken_watch" },
          patches: [{ type: "set_flag", flag: "accused_butler", value: true, reason: "Matched." }]
        }
      ]
    },
    locations: [{ id: "foyer", name: "Foyer", description: "Entry.", exits: [], visibleObjects: ["broken_watch"] }],
    characters: [
      {
        id: "butler",
        name: "Butler",
        publicDescription: "Formal.",
        privateFacts: [],
        knows: [],
        forbiddenDisclosures: [],
        topics: [{ id: "alibi", prompt: "Ask alibi.", revealsFactId: "broken_watch" }]
      }
    ],
    facts: [{ id: "broken_watch", name: "Broken watch", description: "Stopped at nine." }],
    items: [{ id: "greenhouse_key", name: "Greenhouse key", description: "A brass key." }],
    resources: [{ id: "pressure", name: "Pressure", initial: 0, min: 0, max: 5 }],
    relationships: [{ characterId: "butler", name: "Butler trust", initial: 0, min: -5, max: 5 }],
    objectives: [{ id: "solve_murder", name: "Solve murder", stages: ["investigate", "resolved"], initialStage: "investigate" }],
    endings: [{ id: "unresolved_failure", name: "Unresolved", priority: 0, condition: { flag_true: "case_failed" }, text: "The case goes cold." }]
  };
}

describe("validateWorldPack", () => {
  it("accepts a coherent v0.2 pack", () => {
    const result = validateWorldPack(basePack());

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("reports missing entry location and profile mismatch", () => {
    const pack = basePack();
    pack.manifest.entryLocationId = "missing";
    pack.manifest.profileId = "romance";

    const result = validateWorldPack(pack);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Entry location not found: missing");
    expect(result.errors).toContain("Manifest profileId romance does not match profile id detective");
  });

  it("reports broken location and visible object references", () => {
    const pack = basePack();
    pack.locations[0]!.exits = ["study"];
    pack.locations[0]!.visibleObjects = ["missing_object"];

    const result = validateWorldPack(pack);

    expect(result.errors).toContain("Location foyer exits to missing location: study");
    expect(result.errors).toContain("Location foyer references missing visible object: missing_object");
  });

  it("reports character topic fact references", () => {
    const pack = basePack();
    pack.characters[0]!.topics = [{ id: "alibi", prompt: "Ask alibi.", revealsFactId: "missing_fact" }];

    const result = validateWorldPack(pack);

    expect(result.errors).toContain("Character butler topic alibi reveals missing fact: missing_fact");
  });

  it("reports invalid condition references across pack entities", () => {
    const pack = basePack();
    pack.locations[0]!.entryCondition = { has_item: "missing_key" };
    pack.characters[0]!.topics = [
      { id: "secret", prompt: "Ask secret.", unlockCondition: { knows_fact: "missing_fact" } }
    ];
    pack.facts[0]!.discoverableWhen = { location_is: "missing_location" };
    pack.items[0]!.pickupCondition = { relationship_at_least: { character: "missing_character", value: 1 } };
    pack.endings[0]!.condition = { objective_stage_is: { objective: "solve_murder", stage: "missing_stage" } };
    pack.rules.triggers[0]!.when = { resource_at_least: { resource: "missing_resource", value: 1 } };

    const result = validateWorldPack(pack);

    expect(result.errors).toContain("Location foyer entryCondition references missing item: missing_key");
    expect(result.errors).toContain("Character butler topic secret unlockCondition references missing fact: missing_fact");
    expect(result.errors).toContain("Fact broken_watch discoverableWhen references missing location: missing_location");
    expect(result.errors).toContain("Item greenhouse_key pickupCondition references missing character: missing_character");
    expect(result.errors).toContain("Ending unresolved_failure condition references missing objective stage: solve_murder.missing_stage");
    expect(result.errors).toContain("Trigger confront_true_culprit when references missing resource: missing_resource");
  });

  it("reports invalid trigger intent and trigger patch references", () => {
    const pack = basePack();
    pack.rules.triggers = [
      {
        id: "bad_trigger",
        on: { action: "act", intent: "missing_intent" },
        patches: [{ type: "set_objective_stage", objectiveId: "solve_murder", stage: "missing_stage", reason: "Bad." }]
      }
    ];

    const result = validateWorldPack(pack);

    expect(result.errors).toContain("Trigger bad_trigger references missing profile action: missing_intent");
    expect(result.errors).toContain("Trigger bad_trigger patch set_objective_stage references missing objective stage: solve_murder.missing_stage");
  });
});
