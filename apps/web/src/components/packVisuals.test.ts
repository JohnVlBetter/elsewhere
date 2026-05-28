import { describe, expect, it } from "vitest";
import { buildEntityMaps } from "./entityLabels";
import { normalizeTimelineEvent, resolveStoryVisuals } from "./packVisuals";

describe("resolveStoryVisuals", () => {
  it("resolves theme variables and cover style from profile data", () => {
    const visuals = resolveStoryVisuals({
      id: "mist-sect",
      title: "Mist Sect",
      subtitle: "xianxia",
      introduction: "Mist lingers outside the mountain gate.",
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
      title: "Lunch Mixup",
      subtitle: "campus",
      introduction: "The lunch bell rings.",
      version: "0.2.0"
    });

    expect(visuals.cssVars["--story-accent"]).toMatch(/^#/);
    expect(visuals.coverStyle.backgroundImage).toContain("linear-gradient");
    expect(visuals.hasCoverImage).toBe(false);
  });

  it("escapes quoted CSS cover image URLs", () => {
    const visuals = resolveStoryVisuals({
      id: "quoted-cover",
      title: "Quoted Cover",
      subtitle: "test",
      introduction: "A cover path contains CSS string delimiters.",
      version: "0.2.0",
      assets: { coverImage: String.raw`generated\covers/"mist".webp` }
    });

    expect(visuals.coverStyle.backgroundImage).toBe(String.raw`url("generated\\covers/\"mist\".webp")`);
  });
});

describe("normalizeTimelineEvent", () => {
  it("normalizes dialogue metadata and avatar assets", () => {
    const maps = buildEntityMaps({
      locations: [],
      characters: [{ id: "lin", name: "Lin", assets: { avatar: "generated/avatars/lin.webp" } }],
      items: [],
      facts: [],
      objectives: []
    });

    const view = normalizeTimelineEvent({
      id: "evt_1",
      kind: "dialogue",
      text: "I have been waiting for you.",
      timestamp: "2026-05-29T12:00:00.000Z",
      speakerId: "lin",
      speakerName: "Lin",
      visibleToPlayer: true
    }, maps);

    expect(view.title).toBe("Lin");
    expect(view.avatar).toBe("generated/avatars/lin.webp");
  });

  it("preserves the first non-empty assets entry for duplicate ids", () => {
    const maps = buildEntityMaps({
      locations: [],
      characters: [{ id: "shared", name: "Shared Character", assets: { avatar: "generated/avatars/shared.webp" } }],
      items: [],
      facts: [{ id: "shared", name: "Shared Fact" }],
      objectives: []
    });

    const view = normalizeTimelineEvent({
      id: "evt_duplicate_asset",
      kind: "dialogue",
      text: "Assets should survive duplicate ids.",
      timestamp: "2026-05-29T12:00:00.000Z",
      speakerId: "shared",
      speakerName: "Shared Character",
      visibleToPlayer: true
    }, maps);

    expect(view.avatar).toBe("generated/avatars/shared.webp");
  });

  it("maps discovery ref ids to player-facing names", () => {
    const maps = buildEntityMaps({
      locations: [],
      characters: [],
      items: [],
      facts: [{ id: "missed_note", name: "Misplaced Note" }],
      objectives: []
    });

    const view = normalizeTimelineEvent({
      id: "evt_2",
      kind: "evidence",
      text: "The note is tucked into the wrong textbook.",
      timestamp: "2026-05-29T12:00:00.000Z",
      refId: "missed_note",
      visibleToPlayer: true
    }, maps);

    expect(view.title).toBe("Misplaced Note");
  });

  it("uses evidence metadata title before entity labels", () => {
    const maps = buildEntityMaps({
      locations: [],
      characters: [],
      items: [],
      facts: [{ id: "note", name: "Entity Note" }],
      objectives: []
    });

    const view = normalizeTimelineEvent({
      id: "evt_evidence_metadata",
      kind: "evidence",
      text: "The note has a special display name.",
      timestamp: "2026-05-29T12:00:00.000Z",
      refId: "note",
      visibleToPlayer: true,
      metadata: { factName: "Metadata Note" }
    }, maps);

    expect(view.title).toBe("Metadata Note");
    expect(view.refId).toBe("note");
  });

  it("maps item ref ids to item titles", () => {
    const maps = buildEntityMaps({
      locations: [],
      characters: [],
      items: [{ id: "keycard", name: "Keycard" }],
      facts: [],
      objectives: []
    });

    const view = normalizeTimelineEvent({
      id: "evt_item",
      kind: "item",
      text: "You picked up a keycard.",
      timestamp: "2026-05-29T12:00:00.000Z",
      refId: "keycard",
      visibleToPlayer: true
    }, maps);

    expect(view.title).toBe("Keycard");
    expect(view.refId).toBe("keycard");
  });

  it("maps location_change ref ids to location titles", () => {
    const maps = buildEntityMaps({
      locations: [{ id: "library", name: "Library" }],
      characters: [],
      items: [],
      facts: [],
      objectives: []
    });

    const view = normalizeTimelineEvent({
      id: "evt_location",
      kind: "location_change",
      text: "You enter the library.",
      timestamp: "2026-05-29T12:00:00.000Z",
      refId: "library",
      visibleToPlayer: true
    }, maps);

    expect(view.title).toBe("Library");
    expect(view.refId).toBe("library");
  });

  it("leaves non-ref events without a title or ref id", () => {
    const maps = buildEntityMaps({
      locations: [],
      characters: [],
      items: [],
      facts: [],
      objectives: []
    });

    const view = normalizeTimelineEvent({
      id: "evt_scene",
      kind: "scene",
      text: "Rain taps against the windows.",
      timestamp: "2026-05-29T12:00:00.000Z",
      visibleToPlayer: true
    }, maps);

    expect(view).toEqual({
      id: "evt_scene",
      kind: "scene",
      text: "Rain taps against the windows.",
      refId: undefined
    });
  });
});
