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
    { id: "foyer", name: "Foyer", description: "Entry.", exits: ["study"], visibleObjects: ["broken_watch", "silver_watch"] },
    { id: "study", name: "Study", description: "Books.", exits: [], visibleObjects: ["tower_bell_record"] }
  ],
  characters: [
    { id: "butler", name: "Butler", publicDescription: "Precise.", privateFacts: ["He reset the bell."], knows: [], forbiddenDisclosures: ["He reset the bell."], topics: [] },
    { id: "heiress", name: "Heiress", publicDescription: "Tense.", topics: [] }
  ],
  facts: [
    { id: "broken_watch", name: "Broken Watch", description: "The silver pocket watch is cracked and stopped at 8:47.", discoverableWhen: { location_is: "foyer" } },
    { id: "muddy_bootprint", name: "Muddy Bootprint", description: "A narrow print.", discoverableWhen: { location_is: "foyer" } },
    { id: "tower_bell_record", name: "Bell Record", description: "The bell was reset.", discoverableWhen: { location_is: "study" } }
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
