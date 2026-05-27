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
});
