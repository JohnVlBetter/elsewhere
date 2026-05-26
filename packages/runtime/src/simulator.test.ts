import { describe, expect, it } from "vitest";
import { FakeModelProvider } from "@aigame/agents";
import type { WorldPack } from "@aigame/shared";
import { runSimulation } from "./simulator";

const pack: WorldPack = {
  manifest: { id: "cave-breakthrough", name: "Cave Breakthrough", version: "0.2.0", runtimeVersion: "0.2.0", entryLocationId: "outer_cave", profileId: "cultivation" },
  worldText: "A quiet cave before a breakthrough.",
  profile: { id: "cultivation", labels: { facts: "玄机" }, quickActions: [], actions: { cultivate: { aliases: ["cultivate"] } } },
  rules: {
    allowedPatchTypes: ["reveal_fact", "set_flag", "adjust_resource", "adjust_relationship", "set_objective_stage"],
    triggers: [
      {
        id: "cultivate_once",
        on: { action: "act", intent: "cultivate" },
        patches: [
          { type: "adjust_resource", resourceId: "spiritual_power", delta: 2, reason: "Cultivated." },
          { type: "adjust_relationship", characterId: "mentor_echo", delta: 1, reason: "Listened." },
          { type: "set_objective_stage", objectiveId: "breakthrough", stage: "ready", reason: "Prepared." }
        ]
      }
    ]
  },
  locations: [{ id: "outer_cave", name: "Outer Cave", description: "Cold stone.", exits: [], visibleObjects: ["stone_omen"] }],
  characters: [{ id: "mentor_echo", name: "Mentor Echo", publicDescription: "A faint voice.", topics: [] }],
  facts: [{ id: "stone_omen", name: "Stone Omen", description: "The wall hums.", discoverableWhen: { location_is: "outer_cave" } }],
  items: [],
  resources: [{ id: "spiritual_power", name: "Spiritual power", initial: 2, min: 0, max: 10 }],
  relationships: [{ characterId: "mentor_echo", name: "Mentor trust", initial: 0, min: -5, max: 5 }],
  objectives: [{ id: "breakthrough", name: "Breakthrough", stages: ["start", "ready"], initialStage: "start" }],
  endings: []
};

describe("runSimulation", () => {
  it("runs scripted turns against a generic pack", async () => {
    const result = await runSimulation({
      pack,
      steps: ["inspect stone_omen"],
      model: new FakeModelProvider()
    });

    expect(result.finalState.knownFacts).toContain("stone_omen");
    expect(result.turns).toHaveLength(1);
  });

  it("asserts expected generic final state and hidden forbidden phrases", async () => {
    const result = await runSimulation({
      pack,
      steps: ["inspect stone_omen", "cultivate"],
      assertions: {
        expectedKnownFacts: ["stone_omen"],
        expectedFlags: { failed_breakthrough: false },
        expectedResources: { spiritual_power: 4 },
        expectedRelationships: { mentor_echo: 1 },
        expectedObjectiveStages: { breakthrough: "ready" },
        forbiddenOutputPhrases: ["secret demon"]
      },
      model: new FakeModelProvider()
    });

    expect(result.assertionFailures).toEqual([]);
  });

  it("reports assertion failures for missing state and forbidden output leaks", async () => {
    const result = await runSimulation({
      pack,
      steps: ["look"],
      assertions: {
        expectedKnownFacts: ["stone_omen"],
        expectedFlags: { failed_breakthrough: true },
        expectedResources: { spiritual_power: 5 },
        expectedRelationships: { mentor_echo: 2 },
        expectedObjectiveStages: { breakthrough: "ready" },
        forbiddenOutputPhrases: ["secret demon"]
      },
      model: new FakeModelProvider({
        narration: "A secret demon waits.",
        spokenBy: [],
        proposedPatches: [],
        privateNotes: "simulation"
      })
    });

    expect(result.assertionFailures).toEqual([
      "Expected known fact: stone_omen",
      "Expected flag failed_breakthrough=true but got undefined",
      "Expected resource spiritual_power=5 but got 2",
      "Expected relationship mentor_echo=2 but got 0",
      "Expected objective stage breakthrough=ready but got start",
      "Forbidden output phrase leaked: secret demon"
    ]);
  });
});
