import { describe, expect, it } from "vitest";
import { SessionState, WorldPack } from "@aigame/shared";
import { judgeEnding } from "./endings";

const state: SessionState = {
  currentLocationId: "foyer",
  turn: 8,
  inventory: [],
  knownClues: ["broken_watch", "muddy_bootprint"],
  flags: { accused_butler: true },
  npcAttitudes: {},
  questStages: { solve_murder: "accuse" }
};

const pack: WorldPack = {
  manifest: { id: "rain-tower", name: "Rain Tower Murder", version: "0.1.0", runtimeVersion: "0.1.0", entryLocationId: "foyer" },
  worldText: "",
  rules: { allowedPatchTypes: ["set_flag"] },
  locations: [],
  npcs: [],
  clues: [],
  items: [],
  quests: [],
  endings: [
    { id: "wrong_accusation", name: "Wrong", priority: 1, condition: { flag_true: "wrong_accusation" }, text: "The truth slips away." },
    { id: "true_resolution", name: "True", priority: 10, condition: { all: [{ flag_true: "accused_butler" }, { knows_clue: "broken_watch" }, { knows_clue: "muddy_bootprint" }] }, text: "The butler confesses." }
  ],
  prompts: {}
};

describe("judgeEnding", () => {
  it("selects the highest-priority satisfied ending", () => {
    expect(judgeEnding(pack, state)?.id).toBe("true_resolution");
  });

  it("returns undefined when no ending matches", () => {
    expect(judgeEnding({ ...pack, endings: [] }, state)).toBeUndefined();
  });
});
