import { describe, expect, it } from "vitest";
import {
  ActionSchema,
  ConditionSchema,
  PatchSchema,
  SessionStateSchema,
  WorldPackSchema
} from "./domain";

describe("domain schemas", () => {
  it("accepts a valid inspect action", () => {
    const action = ActionSchema.parse({
      type: "inspect",
      targetId: "window",
      rawText: "inspect window"
    });

    expect(action.type).toBe("inspect");
  });

  it("accepts nested all conditions", () => {
    const condition = ConditionSchema.parse({
      all: [{ location_is: "greenhouse" }, { flag_true: "rain_started" }]
    });

    expect("all" in condition).toBe(true);
  });

  it("rejects unknown patch types", () => {
    expect(() =>
      PatchSchema.parse({ type: "rewrite_truth", clueId: "broken_watch" })
    ).toThrow();
  });

  it("accepts the minimum session state", () => {
    const state = SessionStateSchema.parse({
      currentLocationId: "foyer",
      turn: 0,
      inventory: [],
      knownClues: [],
      flags: {},
      npcAttitudes: {},
      questStages: {}
    });

    expect(state.currentLocationId).toBe("foyer");
  });

  it("accepts a small pack object", () => {
    const pack = WorldPackSchema.parse({
      manifest: {
        id: "rain-tower",
        name: "Rain Tower Murder",
        version: "0.1.0",
        runtimeVersion: "0.1.0",
        entryLocationId: "foyer"
      },
      worldText: "A locked-room mystery.",
      rules: { allowedPatchTypes: ["discover_clue", "set_flag"] },
      locations: [{ id: "foyer", name: "Foyer", description: "A cold entry hall.", exits: [] }],
      npcs: [],
      clues: [],
      items: [],
      quests: [],
      endings: [],
      prompts: {}
    });

    expect(pack.manifest.id).toBe("rain-tower");
  });
});
