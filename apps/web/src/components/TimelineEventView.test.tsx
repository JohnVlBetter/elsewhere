// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { buildEntityMaps } from "./entityLabels";
import { cssUrl } from "./packVisuals";
import { TimelineEventView } from "./TimelineEventView";

const maps = buildEntityMaps({
  locations: [{ id: "classroom", name: "教室", assets: { sceneImage: "generated/scenes/classroom.webp" } }],
  characters: [{ id: "lin", name: "林同学", assets: { avatar: "generated/avatars/lin.webp" } }],
  items: [{ id: "paper_note", name: "纸条" }],
  facts: [{ id: "missed_note", name: "错放的纸条" }],
  objectives: []
});

describe("TimelineEventView", () => {
  afterEach(() => cleanup());

  it("renders scene narration as prose", () => {
    render(<TimelineEventView entityMaps={maps} event={{
      id: "evt_scene",
      kind: "scene",
      text: "雨声把走廊尽头的脚步声压得很低。",
      timestamp: "2026-05-29T12:00:00.000Z",
      visibleToPlayer: true
    }} />);

    expect(screen.getByText("雨声把走廊尽头的脚步声压得很低。")).toBeTruthy();
    expect(document.querySelector(".timeline-event--scene")).toBeTruthy();
  });

  it("renders dialogue with avatar slot and speaker name", () => {
    render(<TimelineEventView entityMaps={maps} event={{
      id: "evt_dialogue",
      kind: "dialogue",
      text: "我一直在等你。",
      timestamp: "2026-05-29T12:00:00.000Z",
      speakerId: "lin",
      speakerName: "林同学",
      visibleToPlayer: true
    }} />);

    expect(screen.getByText("林同学")).toBeTruthy();
    expect(document.querySelector(".timeline-event__avatar")).toBeTruthy();
    expect(document.querySelector(".timeline-event__avatar")).toHaveAttribute("data-has-image", "true");
  });

  it("escapes quoted avatar urls before assigning background image style", () => {
    const avatarUrl = "generated/avatars/lin\"quote\\path.webp";
    const specialMaps = buildEntityMaps({
      locations: [],
      characters: [{ id: "lin", name: "Lin", assets: { avatar: avatarUrl } }],
      items: [],
      facts: [],
      objectives: []
    });

    render(<TimelineEventView entityMaps={specialMaps} event={{
      id: "evt_dialogue_escaped",
      kind: "dialogue",
      text: "Avatar path needs escaping.",
      timestamp: "2026-05-29T12:00:00.000Z",
      speakerId: "lin",
      speakerName: "Lin",
      visibleToPlayer: true
    }} />);

    const avatar = document.querySelector(".timeline-event__avatar");
    expect(avatar).toBeTruthy();
    const safeAvatarUrl = cssUrl(avatarUrl);
    expect(safeAvatarUrl).toBeDefined();
    expect(avatar?.getAttribute("style")).toContain(safeAvatarUrl);
  });

  it("does not assign unsafe avatar urls to inline styles", () => {
    const specialMaps = buildEntityMaps({
      locations: [],
      characters: [{ id: "lin", name: "Lin", assets: { avatar: "javascript:alert(1)" } }],
      items: [],
      facts: [],
      objectives: []
    });

    render(<TimelineEventView entityMaps={specialMaps} event={{
      id: "evt_dialogue_unsafe_avatar",
      kind: "dialogue",
      text: "Unsafe avatar path should be ignored.",
      timestamp: "2026-05-29T12:00:00.000Z",
      speakerId: "lin",
      speakerName: "Lin",
      visibleToPlayer: true
    }} />);

    const avatar = document.querySelector(".timeline-event__avatar");
    expect(avatar).toBeTruthy();
    expect(avatar?.getAttribute("style") ?? "").not.toContain("javascript");
  });

  it("renders evidence with a player-facing title", () => {
    render(<TimelineEventView entityMaps={maps} event={{
      id: "evt_evidence",
      kind: "evidence",
      text: "纸条夹在错误的课本里。",
      timestamp: "2026-05-29T12:00:00.000Z",
      refId: "missed_note",
      visibleToPlayer: true
    }} />);

    expect(screen.getByText("错放的纸条")).toBeTruthy();
    expect(screen.getByText("纸条夹在错误的课本里。")).toBeTruthy();
  });

  it("renders icon hooks for typed non-scene events", () => {
    render(<>
      <TimelineEventView entityMaps={maps} event={{
        id: "evt_item",
        kind: "item",
        text: "你收好了纸条。",
        timestamp: "2026-05-29T12:00:00.000Z",
        refId: "paper_note",
        visibleToPlayer: true
      }} />
      <TimelineEventView entityMaps={maps} event={{
        id: "evt_progress",
        kind: "progress",
        text: "午餐误会出现新的进展。",
        timestamp: "2026-05-29T12:00:00.000Z",
        visibleToPlayer: true
      }} />
      <TimelineEventView entityMaps={maps} event={{
        id: "evt_location",
        kind: "location_change",
        text: "你来到走廊。",
        timestamp: "2026-05-29T12:00:00.000Z",
        visibleToPlayer: true
      }} />
    </>);

    expect(document.querySelector("[data-event-kind='item'] [data-testid='timeline-event-icon']")).toBeTruthy();
    expect(document.querySelector("[data-event-kind='progress'] [data-testid='timeline-event-icon']")).toBeTruthy();
    expect(document.querySelector("[data-event-kind='location_change'] [data-testid='timeline-event-icon']")).toBeTruthy();
  });
});
