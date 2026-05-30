import { describe, expect, it } from "vitest";
import { FakeModelProvider } from "@aigame/agents";
import type { SessionState, WorldPack } from "@aigame/shared";
import { runMultiActionTurn } from "./multiTurn";

const pack: WorldPack = {
  manifest: { id: "rain-tower", name: "Rain Tower", version: "0.2.0", runtimeVersion: "0.2.0", entryLocationId: "foyer", profileId: "detective" },
  worldText: "Stormy estate.",
  profile: {
    id: "detective",
    labels: { facts: "线索" },
    quickActions: [],
    actions: {}
  },
  rules: { allowedPatchTypes: ["reveal_fact", "move_location"], triggers: [] },
  locations: [
    { id: "foyer", name: "Foyer", description: "Entry.", exits: ["study"], visibleObjects: ["silver_watch"], visibleCharacters: [] },
    { id: "study", name: "Study", aliases: ["书房"], description: "Books.", exits: [], visibleObjects: [], visibleCharacters: [] }
  ],
  characters: [],
  facts: [
    { id: "broken_watch", kind: "fact", name: "Broken Watch", description: "Stopped at 8:47.", discoverableWhen: { location_is: "foyer" }, tags: [] }
  ],
  items: [{ id: "silver_watch", name: "Silver Watch", aliases: ["怀表"], description: "A watch.", revealsFactId: "broken_watch" }],
  resources: [],
  relationships: [],
  objectives: [],
  endings: []
};

const initialState: SessionState = {
  currentLocationId: "foyer",
  turn: 0,
  inventory: [],
  knownFacts: [],
  resources: {},
  relationships: {},
  flags: {},
  objectiveStages: {}
};

describe("runMultiActionTurn", () => {
  it("executes planned actions in order and carries state forward", async () => {
    const result = await runMultiActionTurn({
      pack,
      state: initialState,
      inputText: "检查怀表并走向书房",
      model: new FakeModelProvider({ narration: "继续。", spokenBy: [], proposedPatches: [], privateNotes: "test" })
    });

    expect(result.actionResults.map((turn) => turn.action.type)).toEqual(["inspect", "move"]);
    expect(result.state.knownFacts).toEqual(["broken_watch"]);
    expect(result.state.currentLocationId).toBe("study");
    expect(result.stoppedAt).toBeUndefined();
  });

  it("stops at the first failed action and skips later actions", async () => {
    const result = await runMultiActionTurn({
      pack,
      state: initialState,
      inputText: "走向地下室并走向书房",
      model: new FakeModelProvider()
    });

    expect(result.actionResults).toHaveLength(1);
    expect(result.actionResults[0]?.action).toMatchObject({ type: "unknown", rawText: "走向地下室" });
    expect(result.state.currentLocationId).toBe("foyer");
    expect(result.stoppedAt).toMatchObject({ actionIndex: 0, inputText: "走向地下室" });
  });

  it("notifies callbacks for each action result", async () => {
    const events: string[] = [];

    await runMultiActionTurn({
      pack,
      state: initialState,
      inputText: "检查怀表并走向书房",
      model: new FakeModelProvider(),
      onActionStart: (event) => events.push(`start:${event.inputText}`),
      onActionResult: (event) => events.push(`result:${event.inputText}`)
    });

    expect(events).toEqual([
      "start:检查怀表",
      "result:检查怀表",
      "start:走向书房",
      "result:走向书房"
    ]);
  });
});
