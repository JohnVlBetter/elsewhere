import { describe, expect, it } from "vitest";
import { FakeModelProvider } from "@aigame/agents";
import type { ModelProvider } from "@aigame/agents";
import type { SessionState, WorldPack } from "@aigame/shared";
import { runTurn } from "./orchestrator";

const pack: WorldPack = {
  manifest: { id: "rain-tower", name: "Rain Tower", version: "0.2.0", runtimeVersion: "0.2.0", entryLocationId: "foyer", profileId: "detective" },
  worldText: "Stormy estate.",
  profile: {
    id: "detective",
    labels: { facts: "线索" },
    quickActions: [],
    actions: { confront: { aliases: ["confront", "accuse", "指认"], requiresTarget: "character", acceptsFacts: true } }
  },
  rules: {
    allowedPatchTypes: ["reveal_fact", "add_item", "move_location", "set_flag"],
    triggers: [
      {
        id: "confront_true_culprit",
        on: { action: "act", intent: "confront", targetId: "butler" },
        when: {
          all: [
            { knows_fact: "broken_watch" },
            { knows_fact: "muddy_bootprint" },
            { knows_fact: "tower_bell_record" }
          ]
        },
        patches: [{ type: "set_flag", flag: "accused_butler", value: true, reason: "Required facts matched." }]
      },
      {
        id: "wrong_confrontation",
        on: { action: "act", intent: "confront" },
        when: {
          not: {
            all: [
              { knows_fact: "broken_watch" },
              { knows_fact: "muddy_bootprint" },
              { knows_fact: "tower_bell_record" }
            ]
          }
        },
        patches: [{ type: "set_flag", flag: "wrong_confrontation", value: true, reason: "Facts were insufficient." }]
      }
    ]
  },
  locations: [
    { id: "foyer", name: "Foyer", description: "Entry.", exits: ["study"], visibleObjects: ["broken_watch", "silver_watch"], visibleCharacters: ["butler", "heiress"] },
    { id: "study", name: "Study", description: "Books.", exits: [], visibleObjects: ["tower_bell_record"], visibleCharacters: [] }
  ],
  characters: [
    {
      id: "butler",
      name: "Butler",
      publicDescription: "Precise.",
      privateFacts: ["He reset the bell."],
      knows: [],
      forbiddenDisclosures: ["He reset the bell.", "LEAK"],
      topics: [{ id: "alibi", prompt: "Ask about the alibi.", unlockCondition: { knows_fact: "broken_watch" }, revealsFactId: "muddy_bootprint" }]
    },
    { id: "heiress", name: "Heiress", publicDescription: "Tense.", privateFacts: [], knows: [], forbiddenDisclosures: [], topics: [] }
  ],
  facts: [
    { id: "broken_watch", kind: "fact", name: "Broken Watch", description: "The silver pocket watch is cracked and stopped at 8:47.", discoverableWhen: { location_is: "foyer" }, tags: [] },
    { id: "muddy_bootprint", kind: "fact", name: "Muddy Bootprint", description: "A narrow print.", discoverableWhen: { location_is: "foyer" }, tags: [] },
    { id: "tower_bell_record", kind: "fact", name: "Bell Record", description: "The bell was reset.", discoverableWhen: { location_is: "study" }, tags: [] },
    { id: "hidden_letter", kind: "fact", name: "Hidden Letter", description: "A locked-away letter.", discoverableWhen: { location_is: "foyer" }, tags: [] }
  ],
  items: [{ id: "silver_watch", name: "Silver Watch", description: "Stopped at 8:47.", revealsFactId: "broken_watch" }],
  resources: [],
  relationships: [],
  objectives: [{ id: "solve_murder", name: "Solve murder", stages: ["investigate", "resolved"], initialStage: "investigate" }],
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
  objectiveStages: { solve_murder: "investigate" }
};

describe("runTurn", () => {
  it("reveals visible facts and advances turn", async () => {
    const result = await runTurn({
      pack,
      state: initialState,
      inputText: "inspect broken_watch",
      model: new FakeModelProvider({
        narration: "The watch is cracked.",
        spokenBy: [],
        proposedPatches: [],
        privateNotes: "test"
      })
    });

    expect(result.state.knownFacts).toEqual(["broken_watch"]);
    expect(result.state.turn).toBe(1);
    expect(result.acceptedPatches).toEqual([{ type: "reveal_fact", factId: "broken_watch", reason: "Inspected broken_watch." }]);
  });

  it("keeps canonical item facts stable when inspecting an item that reveals a fact", async () => {
    const result = await runTurn({
      pack,
      state: initialState,
      inputText: "inspect silver_watch",
      model: new FakeModelProvider({
        narration: "The watch is stopped at exactly nine o'clock.",
        spokenBy: [],
        proposedPatches: [],
        privateNotes: "wrong model detail"
      })
    });

    expect(result.state.knownFacts).toEqual(["broken_watch"]);
    expect(result.outputText).toContain("8:47");
    expect(result.outputText).not.toContain("nine o'clock");
    expect(result.messages).toContainEqual({
      type: "fact",
      factId: "broken_watch",
      label: "Broken Watch",
      text: "The silver pocket watch is cracked and stopped at 8:47."
    });
  });

  it("does not reveal direct fact ids that are not visible in the current scene", async () => {
    const result = await runTurn({
      pack,
      state: initialState,
      inputText: "inspect hidden_letter",
      model: new FakeModelProvider({
        narration: "Nothing obvious changes.",
        spokenBy: [],
        proposedPatches: [],
        privateNotes: "hidden fact probe"
      })
    });

    expect(result.state.knownFacts).toEqual([]);
    expect(result.acceptedPatches).toEqual([]);
  });

  it("rolls back accepted patches when the visible output fails audit", async () => {
    const result = await runTurn({
      pack,
      state: initialState,
      inputText: "look",
      model: new FakeModelProvider({
        narration: "LEAK",
        spokenBy: [],
        proposedPatches: [{ type: "set_flag", flag: "audit_probe", value: true, reason: "Unsafe output." }],
        privateNotes: "unsafe"
      })
    });

    expect(result.outputText).toBe("这一刻的反馈不够清晰，请换一种行动说法。");
    expect(result.state).toEqual({ ...initialState, turn: 1 });
    expect(result.acceptedPatches).toEqual([]);
  });

  it("routes talk actions to an on-demand character actor with scoped context", async () => {
    const requests: Array<Parameters<ModelProvider["generateStructured"]>[0]> = [];
    const model: ModelProvider = {
      async generateStructured<T>(request: Parameters<ModelProvider["generateStructured"]>[0]): Promise<T> {
        requests.push(request);
        return {
          narration: "The butler keeps still.",
          spokenBy: [{ characterId: "butler", text: "I was checking the hall clock." }],
          proposedPatches: [],
          privateNotes: "character actor raw output"
        } as T;
      }
    };

    const result = await runTurn({
      pack,
      state: { ...initialState, knownFacts: ["broken_watch"] },
      inputText: "talk butler about alibi",
      model
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]?.messages[0]?.content).toContain('"id":"butler"');
    expect(requests[0]?.messages[0]?.content).not.toContain("heiress");
    expect(result.outputText).toContain("Butler：I was checking the hall clock.");
    expect(result.messages).toContainEqual({
      type: "character",
      characterId: "butler",
      label: "Butler",
      text: "I was checking the hall clock."
    });
    expect(result.trace.contextIds).toEqual(["location:foyer", "character:butler"]);
    expect(result.trace.agentRole).toBe("character");
  });

  it("reveals a topic fact when a valid talk topic declares revealsFactId", async () => {
    const result = await runTurn({
      pack,
      state: { ...initialState, knownFacts: ["broken_watch"] },
      inputText: "talk butler about alibi",
      model: new FakeModelProvider({
        narration: "",
        spokenBy: [{ characterId: "butler", text: "Look at the mud near the foyer." }],
        proposedPatches: [],
        privateNotes: "topic reveal"
      })
    });

    expect(result.state.knownFacts).toEqual(["broken_watch", "muddy_bootprint"]);
    expect(result.acceptedPatches).toContainEqual({ type: "reveal_fact", factId: "muddy_bootprint", reason: "Topic butler.alibi revealed muddy_bootprint." });
  });

  it("remembers the last visible interlocutor after a successful talk turn", async () => {
    const result = await runTurn({
      pack,
      state: { ...initialState, knownFacts: ["broken_watch"] },
      inputText: "talk butler about alibi",
      model: new FakeModelProvider({
        narration: "",
        spokenBy: [{ characterId: "butler", text: "I was checking the hall clock." }],
        proposedPatches: [],
        privateNotes: "focus"
      })
    });

    expect(result.state.lastInterlocutorId).toBe("butler");
  });

  it("reuses the last interlocutor for the next targetless question", async () => {
    const result = await runTurn({
      pack,
      state: { ...initialState, knownFacts: ["broken_watch"], lastInterlocutorId: "butler" },
      inputText: "继续问他昨晚在哪里",
      model: new FakeModelProvider({
        narration: "",
        spokenBy: [{ characterId: "butler", text: "Still in the kitchen." }],
        proposedPatches: [],
        privateNotes: "follow up"
      })
    });

    expect(result.action).toMatchObject({ type: "talk", characterId: "butler", targetId: "butler" });
  });

  it("clears conversation focus when movement leaves the character behind", async () => {
    const result = await runTurn({
      pack,
      state: { ...initialState, lastInterlocutorId: "butler" },
      inputText: "move study",
      model: new FakeModelProvider()
    });

    expect(result.state.currentLocationId).toBe("study");
    expect(result.state.lastInterlocutorId).toBeUndefined();
  });

  it("drops character speech that does not belong to the scoped talk character", async () => {
    const result = await runTurn({
      pack,
      state: { ...initialState, knownFacts: ["broken_watch"] },
      inputText: "talk butler about alibi",
      model: new FakeModelProvider({
        narration: "",
        spokenBy: [
          { characterId: "butler", text: "I will answer only for myself." },
          { characterId: "heiress", text: "I should not speak in this turn." },
          { characterId: "ghost", text: "Unknown speakers should not render." }
        ],
        proposedPatches: [],
        privateNotes: "cross speaker"
      })
    });

    expect(result.outputText).toContain("Butler：I will answer only for myself.");
    expect(result.outputText).not.toContain("Heiress");
    expect(result.outputText).not.toContain("ghost");
  });

  it("derives confrontation outcomes from pack triggers", async () => {
    const result = await runTurn({
      pack,
      state: { ...initialState, knownFacts: ["broken_watch", "muddy_bootprint", "tower_bell_record"] },
      inputText: "confront butler with broken_watch muddy_bootprint tower_bell_record",
      model: new FakeModelProvider()
    });

    expect(result.state.flags.accused_butler).toBe(true);
    expect(result.acceptedPatches).toContainEqual({ type: "set_flag", flag: "accused_butler", value: true, reason: "Required facts matched." });
  });

  it("blocks impossible movement before model calls", async () => {
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
});
