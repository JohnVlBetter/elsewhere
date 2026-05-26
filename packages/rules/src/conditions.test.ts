import { describe, expect, it } from "vitest";
import type { SessionState } from "@aigame/shared";
import { evaluateCondition } from "./conditions";

const state: SessionState = {
  currentLocationId: "cave",
  turn: 2,
  inventory: ["jade_token"],
  knownFacts: ["stone_omen"],
  resources: { spiritual_power: 5, heart_demon: 1 },
  relationships: { mentor_echo: 3 },
  flags: { incense_lit: true },
  objectiveStages: { breakthrough: "prepared" }
};

describe("evaluateCondition", () => {
  it("evaluates primitive generic conditions", () => {
    expect(evaluateCondition({ location_is: "cave" }, state)).toBe(true);
    expect(evaluateCondition({ has_item: "jade_token" }, state)).toBe(true);
    expect(evaluateCondition({ knows_fact: "stone_omen" }, state)).toBe(true);
    expect(evaluateCondition({ flag_true: "incense_lit" }, state)).toBe(true);
    expect(evaluateCondition({ objective_stage_is: { objective: "breakthrough", stage: "prepared" } }, state)).toBe(true);
  });

  it("evaluates resource and relationship thresholds", () => {
    expect(evaluateCondition({ relationship_at_least: { character: "mentor_echo", value: 3 } }, state)).toBe(true);
    expect(evaluateCondition({ relationship_at_most: { character: "mentor_echo", value: 2 } }, state)).toBe(false);
    expect(evaluateCondition({ resource_at_least: { resource: "spiritual_power", value: 4 } }, state)).toBe(true);
    expect(evaluateCondition({ resource_at_most: { resource: "heart_demon", value: 1 } }, state)).toBe(true);
  });

  it("evaluates nested conditions", () => {
    expect(
      evaluateCondition(
        { all: [{ flag_true: "incense_lit" }, { has_item: "jade_token" }] },
        state
      )
    ).toBe(true);

    expect(
      evaluateCondition(
        { any: [{ resource_at_least: { resource: "spiritual_power", value: 9 } }, { knows_fact: "stone_omen" }] },
        state
      )
    ).toBe(true);

    expect(evaluateCondition({ not: { has_item: "silver_watch" } }, state)).toBe(true);
  });
});
