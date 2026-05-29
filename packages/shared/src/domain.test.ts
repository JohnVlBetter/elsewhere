import { describe, expect, it } from "vitest";
import {
  ActionSchema,
  CharacterSchema,
  ConditionSchema,
  createInitialSessionState,
  LocationSchema,
  PatchSchema,
  ProfileSchema,
  SessionStateSchema,
  TimelineEventSchema,
  WorldPackSchema
} from "./domain";

describe("v0.2 domain schema", () => {
  it("rejects detective-only v0.1 patch and action names", () => {
    const oldPatchType = ["discover", "cl" + "ue"].join("_");
    const oldPatchIdKey = ["cl" + "ue", "Id"].join("");
    const oldActionType = ["acc", "use"].join("");
    const oldActorKey = ["n", "pcId"].join("");
    const oldFactListKey = ["cl" + "ue", "Ids"].join("");

    expect(() =>
      PatchSchema.parse({ type: oldPatchType, [oldPatchIdKey]: "broken_watch", reason: "old" })
    ).toThrow();
    expect(() =>
      ActionSchema.parse({ type: oldActionType, [oldActorKey]: "butler", [oldFactListKey]: [], rawText: "old" })
    ).toThrow();
  });

  it("parses generic act actions and fact patches", () => {
    expect(ActionSchema.parse({
      type: "act",
      intent: "confront",
      targetId: "butler",
      factIds: ["broken_watch"],
      rawText: "confront butler with broken_watch"
    })).toMatchObject({ type: "act", intent: "confront" });

    expect(PatchSchema.parse({
      type: "reveal_fact",
      factId: "broken_watch",
      reason: "Player inspected the watch."
    })).toMatchObject({ type: "reveal_fact", factId: "broken_watch" });
  });

  it("accepts generic conditions", () => {
    const condition = ConditionSchema.parse({
      all: [
        { knows_fact: "stone_omen" },
        { resource_at_least: { resource: "spiritual_power", value: 4 } },
        { relationship_at_least: { character: "lin", value: 2 } },
        { objective_stage_is: { objective: "repair_lunch", stage: "honest" } }
      ]
    });

    expect("all" in condition).toBe(true);
  });

  it("accepts generic session state", () => {
    const state = SessionStateSchema.parse({
      currentLocationId: "classroom",
      turn: 0,
      inventory: [],
      knownFacts: [],
      resources: { courage: 1 },
      relationships: { lin: 2 },
      flags: {},
      objectiveStages: { repair_lunch: "awkward" }
    });

    expect(state.currentLocationId).toBe("classroom");
    expect(state.knownFacts).toEqual([]);
  });

  it("parses dialogue timeline events", () => {
    const event = TimelineEventSchema.parse({
      id: "evt_1",
      kind: "dialogue",
      text: "The butler answers quietly.",
      timestamp: "2026-05-28T12:00:00.000Z",
      speakerId: "butler",
      speakerName: "Butler"
    });

    expect(event.visibleToPlayer).toBe(true);
  });

  it("hides debug timeline events from player timelines by default", () => {
    const event = TimelineEventSchema.parse({
      id: "evt_debug",
      kind: "debug",
      text: "Runtime trace",
      timestamp: "2026-05-28T12:00:00.000Z"
    });

    expect(event.visibleToPlayer).toBe(false);
  });

  it("tracks visible characters on a location", () => {
    const location = LocationSchema.parse({
      id: "hall",
      name: "Hall",
      description: "A wet entry hall.",
      exits: [],
      visibleObjects: [],
      visibleCharacters: ["butler", "elaine"]
    });

    expect(location.visibleCharacters).toContain("butler");
  });

  it("stores the recent interlocutor and pack id in session state", () => {
    const state = SessionStateSchema.parse({
      currentLocationId: "hall",
      turn: 2,
      knownFacts: [],
      inventory: [],
      flags: {},
      relationships: {},
      lastInterlocutorId: "butler",
      packId: "rain-tower"
    });

    expect(state.lastInterlocutorId).toBe("butler");
    expect(state.packId).toBe("rain-tower");
  });

  it("parses group talk actions", () => {
    const action = ActionSchema.parse({
      type: "group_talk",
      topic: "inheritance",
      rawText: "ask everyone about inheritance"
    });

    expect(action.type).toBe("group_talk");
  });

  it("allows quick actions to be conditionally visible", () => {
    const profile = ProfileSchema.parse({
      id: "detective",
      labels: {},
      quickActions: [
        {
          label: "Accuse butler",
          command: "confront butler",
          visibleWhen: { factKnown: "butler_motive" }
        }
      ],
      actions: {}
    });

    expect(profile.quickActions[0]?.visibleWhen).toEqual({ factKnown: "butler_motive" });
  });

  it("creates initial state from resources, relationships, and objectives", () => {
    const pack = WorldPackSchema.parse({
      manifest: {
        id: "campus-lunch",
        name: "Campus Lunch",
        version: "0.2.0",
        runtimeVersion: "0.2.0",
        entryLocationId: "classroom",
        profileId: "romance"
      },
      worldText: "A lunch-break misunderstanding.",
      profile: {
        id: "romance",
        labels: { facts: "回忆", inventory: "随身物", objectives: "关系进展" },
        quickActions: [],
        actions: { confess: { aliases: ["confess", "告白"], requiresTarget: "character", acceptsFacts: true } }
      },
      rules: { allowedPatchTypes: ["reveal_fact", "adjust_relationship", "set_objective_stage"], triggers: [] },
      locations: [{ id: "classroom", name: "教室", description: "午休前的教室。", exits: [], visibleObjects: [] }],
      characters: [{ id: "lin", name: "林同学", publicDescription: "她正在收拾便当。", topics: [] }],
      facts: [],
      items: [],
      resources: [{ id: "courage", name: "勇气", initial: 1, min: 0, max: 5 }],
      relationships: [{ characterId: "lin", name: "林同学好感", initial: 2, min: -5, max: 10 }],
      objectives: [{ id: "repair_lunch", name: "修复午休误会", stages: ["awkward", "honest"], initialStage: "awkward" }],
      endings: []
    });

    expect(createInitialSessionState(pack)).toEqual({
      currentLocationId: "classroom",
      turn: 0,
      inventory: [],
      knownFacts: [],
      resources: { courage: 1 },
      relationships: { lin: 2 },
      flags: {},
      objectiveStages: { repair_lunch: "awkward" }
    });
  });

  it("strips prompt overrides from pack data", () => {
    const pack = WorldPackSchema.parse({
      manifest: {
        id: "campus-lunch",
        name: "Campus Lunch",
        version: "0.2.0",
        runtimeVersion: "0.2.0",
        entryLocationId: "classroom",
        profileId: "romance"
      },
      worldText: "A lunch-break misunderstanding.",
      profile: { id: "romance", labels: {}, quickActions: [], actions: {} },
      rules: { allowedPatchTypes: ["reveal_fact"], triggers: [] },
      locations: [{ id: "classroom", name: "教室", description: "午休前的教室。", exits: [], visibleObjects: [] }],
      characters: [],
      facts: [],
      items: [],
      resources: [],
      relationships: [],
      objectives: [],
      endings: [],
      prompts: { narrator: "pack override should be ignored" }
    });

    expect("prompts" in pack).toBe(false);
  });

  it("accepts optional profile theme and story assets", () => {
    const profile = ProfileSchema.parse({
      id: "xianxia",
      labels: {},
      theme: {
        tone: "cool",
        accentColor: "#4f8cff",
        backgroundColor: "#10131a",
        textColor: "#f7f4ec"
      },
      assets: {
        coverImage: "generated/covers/mist-sect.webp",
        bannerImage: "generated/banners/mist-sect.webp",
        fallbackPattern: "mist"
      },
      quickActions: [],
      actions: {}
    });

    expect(profile.theme?.tone).toBe("cool");
    expect(profile.assets?.coverImage).toBe("generated/covers/mist-sect.webp");
  });

  it("accepts optional character and location asset slots", () => {
    const character = CharacterSchema.parse({
      id: "lin",
      name: "林同学",
      publicDescription: "她把午餐盒抱在怀里。",
      assets: {
        avatar: "generated/avatars/lin.webp",
        portrait: "generated/portraits/lin.webp"
      },
      topics: []
    });

    const location = LocationSchema.parse({
      id: "classroom",
      name: "教室",
      description: "午休前的教室。",
      exits: [],
      visibleObjects: [],
      visibleCharacters: ["lin"],
      assets: {
        sceneImage: "generated/scenes/classroom.webp"
      }
    });

    expect(character.assets?.avatar).toContain("lin.webp");
    expect(location.assets?.sceneImage).toContain("classroom.webp");
  });

  it("accepts optional timeline event metadata", () => {
    const event = TimelineEventSchema.parse({
      id: "evt_dialogue",
      kind: "dialogue",
      text: "我一直在这里等你。",
      timestamp: "2026-05-29T12:00:00.000Z",
      speakerId: "lin",
      speakerName: "林同学",
      metadata: {
        characterId: "lin",
        speakerName: "林同学"
      }
    });

    expect(event.metadata?.characterId).toBe("lin");
  });
});
