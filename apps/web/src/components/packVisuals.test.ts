import { describe, expect, it } from "vitest";
import { buildEntityMaps } from "./entityLabels";
import { normalizeTimelineEvent, resolveStoryVisuals } from "./packVisuals";

describe("resolveStoryVisuals", () => {
  it("resolves theme variables and cover style from profile data", () => {
    const visuals = resolveStoryVisuals({
      id: "mist-sect",
      title: "雾隐宗",
      subtitle: "xianxia",
      introduction: "山门之外雾气未散。",
      version: "0.2.0",
      theme: { tone: "cool", accentColor: "#4f8cff" },
      assets: { coverImage: "generated/covers/mist-sect.webp" }
    });

    expect(visuals.cssVars["--story-accent"]).toBe("#4f8cff");
    expect(visuals.coverStyle.backgroundImage).toContain("generated/covers/mist-sect.webp");
    expect(visuals.hasCoverImage).toBe(true);
  });

  it("uses a complete fallback visual when no assets exist", () => {
    const visuals = resolveStoryVisuals({
      id: "campus-lunch",
      title: "午餐误会",
      subtitle: "campus",
      introduction: "午休铃声响起。",
      version: "0.2.0"
    });

    expect(visuals.cssVars["--story-accent"]).toMatch(/^#/);
    expect(visuals.coverStyle.backgroundImage).toContain("linear-gradient");
    expect(visuals.hasCoverImage).toBe(false);
  });
});

describe("normalizeTimelineEvent", () => {
  it("normalizes dialogue metadata and avatar assets", () => {
    const maps = buildEntityMaps({
      locations: [],
      characters: [{ id: "lin", name: "林同学", assets: { avatar: "generated/avatars/lin.webp" } }],
      items: [],
      facts: [],
      objectives: []
    });

    const view = normalizeTimelineEvent({
      id: "evt_1",
      kind: "dialogue",
      text: "我一直在等你。",
      timestamp: "2026-05-29T12:00:00.000Z",
      speakerId: "lin",
      speakerName: "林同学",
      visibleToPlayer: true
    }, maps);

    expect(view.title).toBe("林同学");
    expect(view.avatar).toBe("generated/avatars/lin.webp");
  });

  it("maps discovery ref ids to player-facing names", () => {
    const maps = buildEntityMaps({
      locations: [],
      characters: [],
      items: [],
      facts: [{ id: "missed_note", name: "错放的纸条" }],
      objectives: []
    });

    const view = normalizeTimelineEvent({
      id: "evt_2",
      kind: "evidence",
      text: "纸条夹在错误的课本里。",
      timestamp: "2026-05-29T12:00:00.000Z",
      refId: "missed_note",
      visibleToPlayer: true
    }, maps);

    expect(view.title).toBe("错放的纸条");
  });
});
