import { describe, expect, it } from "vitest";
import { SessionState, WorldPack } from "@aigame/shared";
import { judgeEnding } from "./endings";

const state: SessionState = {
  currentLocationId: "foyer",
  turn: 8,
  inventory: [],
  knownFacts: ["broken_watch", "muddy_bootprint"],
  resources: {},
  relationships: {},
  flags: { accused_butler: true },
  objectiveStages: { solve_murder: "confront" }
};

const pack: WorldPack = {
  manifest: { id: "rain-tower", name: "Rain Tower Mystery", version: "0.2.0", runtimeVersion: "0.2.0", entryLocationId: "foyer", profileId: "detective" },
  worldText: "",
  profile: { id: "detective", labels: {}, quickActions: [], actions: {} },
  rules: { allowedPatchTypes: ["set_flag"], triggers: [] },
  locations: [],
  characters: [],
  facts: [],
  items: [],
  resources: [],
  relationships: [],
  objectives: [{ id: "solve_murder", name: "Solve mystery", stages: ["investigate", "confront"], initialStage: "investigate" }],
  endings: [
    { id: "wrong_accusation", name: "Wrong", priority: 1, condition: { flag_true: "wrong_accusation" }, text: "The truth slips away." },
    { id: "true_resolution", name: "True", priority: 10, condition: { all: [{ flag_true: "accused_butler" }, { knows_fact: "broken_watch" }, { knows_fact: "muddy_bootprint" }] }, text: "The butler confesses." }
  ]
};

describe("judgeEnding", () => {
  it("selects the highest-priority satisfied ending", () => {
    expect(judgeEnding(pack, state)?.id).toBe("true_resolution");
  });

  it("returns undefined when no ending matches", () => {
    expect(judgeEnding({ ...pack, endings: [] }, state)).toBeUndefined();
  });
});
