import { describe, expect, it } from "vitest";
import { isPlayerVisibleTimelineEvent } from "./timelineVisibility";

describe("isPlayerVisibleTimelineEvent", () => {
  it("hides debug events even if a producer marks them visible", () => {
    expect(isPlayerVisibleTimelineEvent({
      id: "evt_debug",
      kind: "debug",
      text: "Runtime trace",
      timestamp: "2026-05-29T12:00:00.000Z",
      visibleToPlayer: true
    })).toBe(false);
  });

  it("keeps ordinary visible events", () => {
    expect(isPlayerVisibleTimelineEvent({
      id: "evt_scene",
      kind: "scene",
      text: "Rain taps against the glass.",
      timestamp: "2026-05-29T12:00:00.000Z",
      visibleToPlayer: true
    })).toBe(true);
  });
});
