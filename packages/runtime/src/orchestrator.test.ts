import { describe, expect, it } from "vitest";
import { FakeModelProvider } from "@aigame/agents";
import type { ModelProvider } from "@aigame/agents";
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

  it("routes ask actions to an on-demand NPC actor with scoped context", async () => {
    const requests: Array<Parameters<ModelProvider["generateStructured"]>[0]> = [];
    const model: ModelProvider = {
      async generateStructured<T>(request: Parameters<ModelProvider["generateStructured"]>[0]): Promise<T> {
        requests.push(request);
        return {
          narration: "Mr. Vale keeps his answer precise.",
          spokenBy: [{ npcId: "butler", text: "I was checking the hall clock." }],
          proposedPatches: [],
          privateNotes: "npc actor raw output"
        } as T;
      }
    };
    const packWithNpcs: WorldPack = {
      ...pack,
      npcs: [
        {
          id: "butler",
          name: "Mr. Vale",
          publicDescription: "Precise.",
          privateFacts: ["He reset the bell."],
          knows: ["The watch stopped early."],
          forbiddenDisclosures: ["He reset the bell."],
          topics: []
        },
        {
          id: "gardener",
          name: "Mara",
          publicDescription: "Mud on her boots.",
          privateFacts: ["She hid the key."],
          knows: [],
          forbiddenDisclosures: ["She hid the key."],
          topics: []
        }
      ]
    };

    const result = await runTurn({
      pack: packWithNpcs,
      state: { ...initialState, knownClues: ["broken_watch"] },
      inputText: "ask butler alibi",
      model
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]?.system).toContain("NPC Actor");
    expect(requests[0]?.messages[0]?.content).toContain('"id":"butler"');
    expect(requests[0]?.messages[0]?.content).not.toContain("gardener");
    expect(result.outputText).toContain("Mr. Vale");
    expect(result.trace.contextIds).toEqual(["location:foyer", "npc:butler"]);
    expect(result.trace.agentRole).toBe("npc");
    expect(result.trace.agentRawOutput).toMatchObject({ privateNotes: "npc actor raw output" });
  });

  it("passes the configured model name to the provider", async () => {
    const requests: Array<Parameters<ModelProvider["generateStructured"]>[0]> = [];
    const model: ModelProvider = {
      async generateStructured<T>(request: Parameters<ModelProvider["generateStructured"]>[0]): Promise<T> {
        requests.push(request);
        return {
          narration: "The room answers with a useful detail.",
          spokenBy: [],
          proposedPatches: [],
          privateNotes: "configured model used"
        } as T;
      }
    };

    await runTurn({
      pack,
      state: initialState,
      inputText: "look",
      model,
      modelName: "deepseek-v4-pro"
    });

    expect(requests[0]?.model).toBe("deepseek-v4-pro");
    expect(requests[0]?.system).toContain("JSON");
  });

  it("runs rules precheck before model calls and blocks impossible actions", async () => {
    const model: ModelProvider = {
      async generateStructured<T>(): Promise<T> {
        throw new Error("model should not be called when precheck fails");
      }
    };

    const result = await runTurn({
      pack,
      state: initialState,
      inputText: "move greenhouse",
      model
    });

    expect(result.outputText).toBe("That action is blocked: Location is not reachable: greenhouse");
    expect(result.state).toEqual({ ...initialState, turn: 1 });
    expect(result.acceptedPatches).toEqual([]);
    expect(result.rejectedPatches).toEqual([]);
    expect(result.trace.precheck).toEqual({ ok: false, reason: "Location is not reachable: greenhouse" });
    expect(result.trace.agentRawOutput).toBeUndefined();
  });
});
