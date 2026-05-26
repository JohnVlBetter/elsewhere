import { describe, expect, it } from "vitest";
import { FakeModelProvider } from "@aigame/agents";
import type { ModelProvider } from "@aigame/agents";
import { WorldPack, SessionState } from "@aigame/shared";
import { runTurn } from "./orchestrator";

const pack: WorldPack = {
  manifest: { id: "rain-tower", name: "Rain Tower Murder", version: "0.1.0", runtimeVersion: "0.1.0", entryLocationId: "foyer" },
  worldText: "Stormy estate.",
  rules: { allowedPatchTypes: ["discover_clue", "add_item", "move_location", "set_flag"] },
  locations: [{ id: "foyer", name: "Foyer", description: "Entry.", exits: ["study"], visibleObjects: ["broken_watch", "silver_watch"] }, { id: "study", name: "Study", description: "Books.", exits: [], visibleObjects: [] }],
  npcs: [],
  clues: [{ id: "broken_watch", name: "Broken Watch", description: "Stopped.", discoverableWhen: { location_is: "foyer" }, accusationWeight: 2 }],
  items: [{ id: "silver_watch", name: "Silver Watch", description: "Stopped at 8:47.", revealsClueId: "broken_watch" }],
  quests: [],
  endings: []
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
    expect(requests[0]?.system).toContain("spokenBy 必须只包含当前 NPC");
    expect(requests[0]?.messages[0]?.content).toContain('"id":"butler"');
    expect(requests[0]?.messages[0]?.content).not.toContain("gardener");
    expect(result.outputText).toContain("Mr. Vale：I was checking the hall clock.");
    expect(result.messages).toContainEqual({
      type: "npc",
      npcId: "butler",
      label: "Mr. Vale",
      text: "I was checking the hall clock."
    });
    expect(result.trace.contextIds).toEqual(["location:foyer", "npc:butler"]);
    expect(result.trace.agentRole).toBe("npc");
    expect(result.trace.agentRawOutput).toMatchObject({ privateNotes: "npc actor raw output" });
  });

  it("keeps canonical item facts stable when inspecting an item that reveals a clue", async () => {
    const result = await runTurn({
      pack: {
        ...pack,
        clues: [
          {
            id: "broken_watch",
            name: "Broken Watch",
            description: "The silver pocket watch is cracked and stopped at 8:47.",
            discoverableWhen: { location_is: "foyer" },
            accusationWeight: 2
          }
        ]
      },
      state: initialState,
      inputText: "inspect silver_watch",
      model: new FakeModelProvider({
        narration: "The watch is stopped at exactly nine o'clock.",
        spokenBy: [],
        proposedPatches: [],
        privateNotes: "wrong model detail"
      })
    });

    expect(result.state.knownClues).toEqual(["broken_watch"]);
    expect(result.outputText).toContain("8:47");
    expect(result.outputText).not.toContain("nine o'clock");
    expect(result.messages).toContainEqual({
      type: "clue",
      clueId: "broken_watch",
      label: "Broken Watch",
      text: "The silver pocket watch is cracked and stopped at 8:47."
    });
  });

  it("adds visible picked-up items to inventory and reports the item gain", async () => {
    const result = await runTurn({
      pack,
      state: initialState,
      inputText: "take silver_watch",
      model: new FakeModelProvider({
        narration: "You take the silver watch.",
        spokenBy: [],
        proposedPatches: [],
        privateNotes: "take item"
      })
    });

    expect(result.state.inventory).toEqual(["silver_watch"]);
    expect(result.acceptedPatches).toEqual([{ type: "add_item", itemId: "silver_watch", reason: "Took silver_watch." }]);
    expect(result.messages).toContainEqual({
      type: "item",
      itemId: "silver_watch",
      label: "Silver Watch",
      text: "Stopped at 8:47."
    });
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

  it("uses core role prompts and ignores pack prompt overrides", async () => {
    const requests: Array<Parameters<ModelProvider["generateStructured"]>[0]> = [];
    const model: ModelProvider = {
      async generateStructured<T>(request: Parameters<ModelProvider["generateStructured"]>[0]): Promise<T> {
        requests.push(request);
        return {
          narration: "门厅的烛光晃了一下。",
          spokenBy: [],
          proposedPatches: [],
          privateNotes: "prompt capture"
        } as T;
      }
    };

    await runTurn({
      pack: ({
        ...pack,
        prompts: {
          language: "PACK LANGUAGE OVERRIDE",
          narrator: "PACK NARRATOR OVERRIDE",
          npc: "PACK NPC OVERRIDE"
        }
      } as WorldPack),
      state: initialState,
      inputText: "look",
      model
    });

    expect(requests[0]?.system).toContain("核心约束：context 是唯一事实来源");
    expect(requests[0]?.system).toContain("旁白不得替 NPC 发言");
    expect(requests[0]?.system).not.toContain("PACK LANGUAGE OVERRIDE");
    expect(requests[0]?.system).not.toContain("PACK NARRATOR OVERRIDE");
    expect(requests[0]?.system).not.toContain("PACK NPC OVERRIDE");
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

    expect(result.outputText).toBe("行动暂时无法完成：当前位置无法前往 greenhouse。");
    expect(result.state).toEqual({ ...initialState, turn: 1 });
    expect(result.acceptedPatches).toEqual([]);
    expect(result.rejectedPatches).toEqual([]);
    expect(result.trace.precheck).toEqual({ ok: false, reason: "Location is not reachable: greenhouse" });
    expect(result.trace.agentRawOutput).toBeUndefined();
  });

  it("runs location entry conditions before model calls", async () => {
    const model: ModelProvider = {
      async generateStructured<T>(): Promise<T> {
        throw new Error("model should not be called when entry condition fails");
      }
    };

    const result = await runTurn({
      pack: {
        ...pack,
        locations: [
          { id: "foyer", name: "Foyer", description: "Entry.", exits: ["study"], visibleObjects: [] },
          {
            id: "study",
            name: "Study",
            description: "Books.",
            exits: [],
            visibleObjects: [],
            entryCondition: { has_item: "greenhouse_key" }
          }
        ]
      },
      state: initialState,
      inputText: "move study",
      model
    });

    expect(result.outputText).toBe("行动暂时无法完成：当前条件还不能进入 study。");
    expect(result.state).toEqual({ ...initialState, turn: 1 });
    expect(result.trace.precheck).toEqual({ ok: false, reason: "Location entry condition failed: study" });
    expect(result.trace.agentRawOutput).toBeUndefined();
  });

  it("runs NPC topic unlock conditions before model calls", async () => {
    const model: ModelProvider = {
      async generateStructured<T>(): Promise<T> {
        throw new Error("model should not be called when topic is locked");
      }
    };

    const result = await runTurn({
      pack: {
        ...pack,
        npcs: [
          {
            id: "butler",
            name: "Mr. Vale",
            publicDescription: "Precise.",
            privateFacts: [],
            knows: [],
            forbiddenDisclosures: [],
            topics: [
              {
                id: "secret",
                prompt: "Ask about the hidden bell record.",
                unlockCondition: { knows_clue: "broken_watch" },
                revealsClueId: "broken_watch"
              }
            ]
          }
        ]
      },
      state: initialState,
      inputText: "ask butler secret",
      model
    });

    expect(result.outputText).toBe("行动暂时无法完成：当前还不能询问 butler 的 secret。");
    expect(result.state).toEqual({ ...initialState, turn: 1 });
    expect(result.trace.precheck).toEqual({ ok: false, reason: "Topic unlock condition failed: butler.secret" });
    expect(result.trace.agentRawOutput).toBeUndefined();
  });
});
