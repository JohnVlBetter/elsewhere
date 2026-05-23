import { describe, expect, it } from "vitest";
import { FakeModelProvider } from "@aigame/agents";
import { WorldPack, SessionState } from "@aigame/shared";
import { runTurn } from "./orchestrator";

const pack: WorldPack = {
  manifest: { id: "rain-tower", name: "Rain Tower Murder", version: "0.1.0", runtimeVersion: "0.1.0", entryLocationId: "foyer" },
  worldText: "Stormy estate.",
  rules: { allowedPatchTypes: ["discover_clue", "move_location", "set_flag"] },
  locations: [{ id: "foyer", name: "Foyer", description: "Entry.", exits: ["study"], visibleObjects: ["broken_watch"] }, { id: "study", name: "Study", description: "Books.", exits: [], visibleObjects: [] }],
  npcs: [],
  clues: [{ id: "broken_watch", name: "Broken Watch", description: "Stopped.", discoverableWhen: { location_is: "foyer" }, accusationWeight: 2 }],
  items: [],
  quests: [],
  endings: [],
  prompts: {}
};

const initialState: SessionState = {
  currentLocationId: "foyer",
  turn: 0,
  inventory: [],
  knownClues: [],
  flags: {},
  npcAttitudes: {},
  questStages: {}
};

describe("runTurn", () => {
  it("accepts valid agent patches and advances turn", async () => {
    const result = await runTurn({
      pack,
      state: initialState,
      inputText: "inspect broken_watch",
      model: new FakeModelProvider({
        narration: "The watch is cracked and stopped.",
        spokenBy: [],
        proposedPatches: [{ type: "discover_clue", clueId: "broken_watch", reason: "Player inspected it." }],
        privateNotes: "test"
      })
    });

    expect(result.state.knownClues).toEqual(["broken_watch"]);
    expect(result.state.turn).toBe(1);
    expect(result.rejectedPatches).toEqual([]);
  });
});
