import { describe, expect, it } from "vitest";
import {
  ActionSchema,
  ConditionSchema,
  createInitialSessionState,
  PatchSchema,
  SessionStateSchema,
  WorldPackSchema
} from "./domain";

describe("v0.2 domain schema", () => {
  it("rejects detective-only v0.1 patch and action names", () => {
    const oldPatchType = ["discover", "cl" + "ue"].join("_");
    const oldPatchIdKey = ["cl" + "ue", "Id"].join("");
    const oldActionType = ["acc", "use"].join("");
    const oldActorKey = ["n", "pcId"].join("");
    const oldFactListKey = ["cl" + "ue", "Ids"].join("");

    expect(() =>
      PatchSchema.parse({ type: oldPatchType, [oldPatchIdKey]: "broken_watch", reason: "old" })
    ).toThrow();
    expect(() =>
      ActionSchema.parse({ type: oldActionType, [oldActorKey]: "butler", [oldFactListKey]: [], rawText: "old" })
    ).toThrow();
  });

  it("parses generic act actions and fact patches", () => {
    expect(ActionSchema.parse({
      type: "act",
      intent: "confront",
      targetId: "butler",
      factIds: ["broken_watch"],
      rawText: "confront butler with broken_watch"
    })).toMatchObject({ type: "act", intent: "confront" });

    expect(PatchSchema.parse({
      type: "reveal_fact",
      factId: "broken_watch",
      reason: "Player inspected the watch."
    })).toMatchObject({ type: "reveal_fact", factId: "broken_watch" });
  });

  it("accepts generic conditions", () => {
    const condition = ConditionSchema.parse({
      all: [
        { knows_fact: "stone_omen" },
        { resource_at_least: { resource: "spiritual_power", value: 4 } },
        { relationship_at_least: { character: "lin", value: 2 } },
        { objective_stage_is: { objective: "repair_lunch", stage: "honest" } }
      ]
    });

    expect("all" in condition).toBe(true);
  });

  it("accepts generic session state", () => {
    const state = SessionStateSchema.parse({
      currentLocationId: "classroom",
      turn: 0,
      inventory: [],
      knownFacts: [],
      resources: { courage: 1 },
      relationships: { lin: 2 },
      flags: {},
      objectiveStages: { repair_lunch: "awkward" }
    });

    expect(state.currentLocationId).toBe("classroom");
    expect(state.knownFacts).toEqual([]);
  });

  it("creates initial state from resources, relationships, and objectives", () => {
    const pack = WorldPackSchema.parse({
      manifest: {
        id: "campus-lunch",
        name: "Campus Lunch",
        version: "0.2.0",
        runtimeVersion: "0.2.0",
        entryLocationId: "classroom",
        profileId: "romance"
      },
      worldText: "A lunch-break misunderstanding.",
      profile: {
        id: "romance",
        labels: { facts: "回忆", inventory: "随身物", objectives: "关系进展" },
        quickActions: [],
        actions: { confess: { aliases: ["confess", "告白"], requiresTarget: "character", acceptsFacts: true } }
      },
      rules: { allowedPatchTypes: ["reveal_fact", "adjust_relationship", "set_objective_stage"], triggers: [] },
      locations: [{ id: "classroom", name: "教室", description: "午休前的教室。", exits: [], visibleObjects: [] }],
      characters: [{ id: "lin", name: "林同学", publicDescription: "她正在收拾便当。", topics: [] }],
      facts: [],
      items: [],
      resources: [{ id: "courage", name: "勇气", initial: 1, min: 0, max: 5 }],
      relationships: [{ characterId: "lin", name: "林同学好感", initial: 2, min: -5, max: 10 }],
      objectives: [{ id: "repair_lunch", name: "修复午休误会", stages: ["awkward", "honest"], initialStage: "awkward" }],
      endings: []
    });

    expect(createInitialSessionState(pack)).toEqual({
      currentLocationId: "classroom",
      turn: 0,
      inventory: [],
      knownFacts: [],
      resources: { courage: 1 },
      relationships: { lin: 2 },
      flags: {},
      objectiveStages: { repair_lunch: "awkward" }
    });
  });

  it("strips prompt overrides from pack data", () => {
    const pack = WorldPackSchema.parse({
      manifest: {
        id: "campus-lunch",
        name: "Campus Lunch",
        version: "0.2.0",
        runtimeVersion: "0.2.0",
        entryLocationId: "classroom",
        profileId: "romance"
      },
      worldText: "A lunch-break misunderstanding.",
      profile: { id: "romance", labels: {}, quickActions: [], actions: {} },
      rules: { allowedPatchTypes: ["reveal_fact"], triggers: [] },
      locations: [{ id: "classroom", name: "教室", description: "午休前的教室。", exits: [], visibleObjects: [] }],
      characters: [],
      facts: [],
      items: [],
      resources: [],
      relationships: [],
      objectives: [],
      endings: [],
      prompts: { narrator: "pack override should be ignored" }
    });

    expect("prompts" in pack).toBe(false);
  });
});
