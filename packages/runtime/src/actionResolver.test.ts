import { describe, expect, it } from "vitest";
import type { ModelProvider } from "@aigame/agents";
import type { SessionState, WorldPack } from "@aigame/shared";
import { resolveActionSegmentsWithModel, RuleBackedActionResolverProvider } from "./actionResolver";

const pack: WorldPack = {
  manifest: { id: "rain-tower", name: "Rain Tower", version: "0.2.0", runtimeVersion: "0.2.0", entryLocationId: "foyer", profileId: "detective" },
  worldText: "Stormy estate.",
  profile: {
    id: "detective",
    labels: { facts: "线索" },
    quickActions: [],
    actions: { confront: { aliases: ["指认"], requiresTarget: "character", acceptsFacts: true } }
  },
  rules: { allowedPatchTypes: ["reveal_fact", "move_location"], triggers: [] },
  locations: [
    { id: "foyer", name: "门厅", aliases: ["大厅"], description: "Entry.", exits: ["study"], visibleObjects: ["silver_watch"], visibleCharacters: ["butler"] },
    { id: "study", name: "书房", aliases: ["study"], description: "Books.", exits: ["foyer"], visibleObjects: [], visibleCharacters: [] }
  ],
  characters: [{ id: "butler", name: "管家", aliases: ["管家维尔"], publicDescription: "Precise.", privateFacts: [], knows: [], forbiddenDisclosures: [], topics: [] }],
  facts: [{ id: "broken_watch", kind: "fact", name: "破损怀表", description: "Stopped at 8:47.", discoverableWhen: { location_is: "foyer" }, tags: [] }],
  items: [{ id: "silver_watch", name: "银怀表", aliases: ["怀表"], description: "A watch.", revealsFactId: "broken_watch" }],
  resources: [],
  relationships: [],
  objectives: [],
  endings: []
};

const state: SessionState = {
  currentLocationId: "foyer",
  turn: 0,
  inventory: [],
  knownFacts: [],
  resources: {},
  relationships: {},
  flags: {},
  objectiveStages: {}
};

describe("resolveActionSegmentsWithModel", () => {
  it("uses the resolver model to map location-looking language to look", async () => {
    const requests: Array<Parameters<ModelProvider["generateStructured"]>[0]> = [];
    const model: ModelProvider = {
      async generateStructured<T>(request: Parameters<ModelProvider["generateStructured"]>[0]): Promise<T> {
        requests.push(request);
        return {
          actions: [
            {
              rawText: "查看门厅内",
              action: { type: "look" }
            }
          ]
        } as T;
      }
    };

    const segments = await resolveActionSegmentsWithModel({
      pack,
      state,
      inputText: "查看门厅内",
      model,
      modelName: "deepseek-v4-flash"
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]?.model).toBe("deepseek-v4-flash");
    expect(requests[0]?.system).toContain("只负责把玩家输入解析为行动 JSON");
    expect(segments).toEqual([
      { rawText: "查看门厅内", action: { type: "look", rawText: "查看门厅内" } }
    ]);
  });

  it("normalizes a location inspect returned by the model into look", async () => {
    const model: ModelProvider = {
      async generateStructured<T>(): Promise<T> {
        return {
          actions: [{ rawText: "查看门厅内", action: { type: "inspect", targetId: "foyer" } }]
        } as T;
      }
    };

    await expect(resolveActionSegmentsWithModel({ pack, state, inputText: "查看门厅内", model, modelName: "deepseek-v4-flash" }))
      .resolves.toEqual([{ rawText: "查看门厅内", action: { type: "look", rawText: "查看门厅内" } }]);
  });

  it("uses rule-backed parsing when the model returns unknown for a recognizable location look", async () => {
    const model: ModelProvider = {
      async generateStructured<T>(): Promise<T> {
        return {
          actions: [{ rawText: "环顾门厅内", action: { type: "unknown" } }]
        } as T;
      }
    };

    await expect(resolveActionSegmentsWithModel({ pack, state, inputText: "环顾门厅内", model, modelName: "deepseek-v4-flash" }))
      .resolves.toEqual([{ rawText: "环顾门厅内", action: { type: "look", rawText: "环顾门厅内" } }]);
  });

  it("accepts flat action entries returned by json_object models", async () => {
    const model: ModelProvider = {
      async generateStructured<T>(): Promise<T> {
        return {
          actions: [{ rawText: "模型指定移动", type: "move", locationId: "study" }]
        } as T;
      }
    };

    await expect(resolveActionSegmentsWithModel({ pack, state, inputText: "模型指定移动", model, modelName: "deepseek-v4-flash" }))
      .resolves.toEqual([{ rawText: "模型指定移动", action: { type: "move", locationId: "study", rawText: "模型指定移动" } }]);
  });

  it("uses rule-backed parsing when the model response has no valid action segments", async () => {
    const model: ModelProvider = {
      async generateStructured<T>(): Promise<T> {
        return { actions: [] } as T;
      }
    };

    await expect(resolveActionSegmentsWithModel({ pack, state, inputText: "环顾门厅内", model, modelName: "deepseek-v4-flash" }))
      .resolves.toEqual([{ rawText: "环顾门厅内", action: { type: "look", rawText: "环顾门厅内" } }]);
  });
});

describe("RuleBackedActionResolverProvider", () => {
  it("keeps local fake dev sessions usable without a cloud resolver", async () => {
    const segments = await resolveActionSegmentsWithModel({
      pack,
      state,
      inputText: "检查怀表并走向书房",
      model: new RuleBackedActionResolverProvider(),
      modelName: "fake"
    });

    expect(segments.map((segment) => segment.action.type)).toEqual(["inspect", "move"]);
  });
});
