// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { buildEntityMaps } from "./entityLabels";
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
});
