import { describe, expect, it } from "vitest";
import { SessionState } from "@aigame/shared";
import { evaluateCondition } from "./conditions";

const state: SessionState = {
  currentLocationId: "greenhouse",
  turn: 3,
  inventory: ["greenhouse_key"],
  knownClues: ["muddy_bootprint"],
  flags: { rain_started: true },
  npcAttitudes: { gardener: 2 },
  questStages: { solve_murder: "investigate" }
};

describe("evaluateCondition", () => {
  it("evaluates primitive conditions", () => {
    expect(evaluateCondition({ location_is: "greenhouse" }, state)).toBe(true);
    expect(evaluateCondition({ has_item: "greenhouse_key" }, state)).toBe(true);
    expect(evaluateCondition({ knows_clue: "muddy_bootprint" }, state)).toBe(true);
    expect(evaluateCondition({ flag_true: "rain_started" }, state)).toBe(true);
  });

  it("evaluates nested conditions", () => {
    expect(
      evaluateCondition(
        { all: [{ location_is: "greenhouse" }, { npc_attitude_at_least: { npc: "gardener", value: 2 } }] },
        state
      )
    ).toBe(true);

    expect(evaluateCondition({ not: { has_item: "silver_watch" } }, state)).toBe(true);
  });

  it("evaluates quest stages", () => {
    expect(evaluateCondition({ quest_stage_is: { quest: "solve_murder", stage: "investigate" } }, state)).toBe(true);
  });
});
