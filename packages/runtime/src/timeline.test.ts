import { describe, expect, it } from "vitest";
import { buildTimelineEvents } from "./timeline";

describe("buildTimelineEvents", () => {
  it("creates separate events for action, narration, dialogue, and evidence", () => {
    const events = buildTimelineEvents({
      command: "ask butler",
      timestamp: "2026-05-28T12:00:00.000Z",
      messages: [
        { type: "narration", text: "Rain quiets the hall." },
        { type: "character", characterId: "butler", label: "Butler", text: "I was in the kitchen." },
        { type: "fact", factId: "butler_kitchen", label: "Kitchen Alibi", text: "The butler claims he stayed in the kitchen." }
      ],
      patches: [{ type: "reveal_fact", factId: "butler_kitchen", reason: "Topic revealed fact." }]
    });

    expect(events.map((event) => event.kind)).toEqual([
      "player_action",
      "scene",
      "dialogue",
      "evidence"
    ]);
  });

  it("marks scene events with their source message type", () => {
    const events = buildTimelineEvents({
      command: "look",
      timestamp: "2026-05-30T12:00:00.000Z",
      messages: [
        { type: "environment", text: "雨水沿着门厅地砖流动。" },
        { type: "narration", text: "这一发现让时间线微微错位。" }
      ],
      patches: []
    });

    expect(events.slice(1).map((event) => event.metadata)).toEqual([
      { messageType: "environment" },
      { messageType: "narration" }
    ]);
  });

  it("creates resource and relationship events from accepted patches", () => {
    const events = buildTimelineEvents({
      command: "鼓励林同学",
      timestamp: "2026-05-30T12:00:00.000Z",
      messages: [],
      patches: [
        { type: "adjust_relationship", characterId: "lin", delta: 2, reason: "Encouraged Lin." },
        { type: "adjust_resource", resourceId: "courage", delta: 1, reason: "Gained courage." },
        { type: "set_resource", resourceId: "focus", value: 3, reason: "Focused." }
      ],
      pack: {
        manifest: { id: "p", name: "P", version: "0.1.0", runtimeVersion: "0.1.0", entryLocationId: "room", profileId: "test" },
        worldText: "",
        profile: { id: "test", labels: {}, quickActions: [], actions: {} },
        rules: { allowedPatchTypes: ["adjust_relationship", "adjust_resource", "set_resource"], triggers: [] },
        locations: [{ id: "room", name: "Room", description: "", exits: [], visibleObjects: [], visibleCharacters: [] }],
        characters: [{ id: "lin", name: "林同学", publicDescription: "", privateFacts: [], knows: [], forbiddenDisclosures: [], topics: [] }],
        facts: [],
        items: [],
        resources: [
          { id: "courage", name: "勇气", initial: 0, min: 0, max: 5 },
          { id: "focus", name: "专注", initial: 0, min: 0, max: 5 }
        ],
        relationships: [{ characterId: "lin", name: "林同学好感", initial: 0, min: -5, max: 10 }],
        objectives: [],
        endings: []
      }
    });

    expect(events.map((event) => event.kind)).toEqual(["player_action", "relationship", "resource", "resource"]);
    expect(events[1]?.text).toBe("林同学好感 +2");
    expect(events[2]?.text).toBe("勇气 +1");
    expect(events[3]?.text).toBe("专注 = 3");
  });
});
