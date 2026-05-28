# Generic Immersive Story UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the web UI into a generic immersive story reader with optional pack themes and reserved asset slots for covers, avatars, portraits, and scene art.

**Architecture:** Keep the current Next.js/React monorepo structure. Add shared visual contracts first, expose them through pack summaries and session responses, normalize visual data in a small frontend helper, then redesign the story library, reader timeline, composer, sidebar, and CSS around those contracts.

**Tech Stack:** TypeScript, Zod, Next.js App Router, React 19, Vitest, Testing Library, Playwright, CSS custom properties.

---

## Scope Check

This plan covers one product slice: the generic immersive web player. It includes UI-facing contract changes, because the confirmed spec requires theme and asset slots. It does not implement AIGC image generation, pack editing, cloud asset storage, visual-novel sprite staging, or broad runtime behavior changes unrelated to player-facing UI.

## File Responsibility Map

- `packages/shared/src/domain.ts`: owns Zod schemas and exported types for profile theme/assets, character assets, location assets, and optional timeline metadata.
- `packages/shared/src/domain.test.ts`: verifies the new optional visual contract stays backward compatible.
- `packages/pack/src/listPacks.ts`: includes theme/assets in story summaries.
- `packages/pack/src/listPacks.test.ts`: verifies story summary visual fields.
- `apps/web/src/server/packRegistry.ts`: loads pack summaries and individual packs for the web app.
- `apps/web/app/api/session/route.ts`: returns profile, entity labels, entity assets, and readable Chinese errors.
- `apps/web/app/api/session/route.test.ts`: verifies session response includes visual fields and valid Chinese text.
- `apps/web/src/components/packVisuals.ts`: resolves theme tokens, asset references, fallback visuals, entity labels, and normalized timeline view models.
- `apps/web/src/components/packVisuals.test.ts`: tests visual fallback and timeline normalization without rendering the whole app.
- `apps/web/src/components/PackOverview.tsx`: renders the story library.
- `apps/web/src/components/PackOverview.test.tsx`: verifies story cards with and without covers.
- `apps/web/src/components/TimelineEventView.tsx`: renders typed timeline events.
- `apps/web/src/components/TimelineEventView.test.tsx`: verifies scene prose, dialogue avatar slots, and discovery blocks.
- `apps/web/src/components/ActionComposer.tsx`: renders reader-friendly input and quick actions.
- `apps/web/src/components/StateSidebar.tsx`: renders player-facing state with labels and asset slots.
- `apps/web/src/components/GameShell.tsx`: owns session flow, status copy, retry behavior, visual props, and layout composition.
- `apps/web/src/components/GameShell.test.tsx`: verifies end-to-end component behavior.
- `apps/web/src/components/turnStream.ts`: maps server statuses to player-safe copy.
- `apps/web/src/components/turnStream.test.ts`: verifies no model/runtime wording leaks.
- `apps/web/app/globals.css`: implements the neutral immersive visual system and responsive layout.
- `apps/web/tests/player.spec.ts`: browser acceptance for story library, reader, event types, and hidden debug/runtime copy.

## Task 1: Shared Visual Contracts

**Files:**
- Modify: `packages/shared/src/domain.ts`
- Modify: `packages/shared/src/domain.test.ts`

- [ ] **Step 1: Add failing schema tests**

Append these tests inside `describe("v0.2 domain schema", () => { ... })` in `packages/shared/src/domain.test.ts`.

```ts
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
```

- [ ] **Step 2: Run the targeted test and verify failure**

Run: `npm test -- packages/shared/src/domain.test.ts`

Expected before implementation: failures mention unrecognized or missing `theme`, `assets`, `metadata`, or missing imports for `CharacterSchema`.

- [ ] **Step 3: Export visual schemas and types**

Modify `packages/shared/src/domain.ts` near `ProfileActionSchema`.

```ts
export const ProfileThemeSchema = z.object({
  tone: z.enum(["neutral", "warm", "cool", "dark", "light"]).optional(),
  accentColor: z.string().min(1).optional(),
  backgroundColor: z.string().min(1).optional(),
  textColor: z.string().min(1).optional()
});

export const ProfileAssetsSchema = z.object({
  coverImage: z.string().min(1).optional(),
  bannerImage: z.string().min(1).optional(),
  fallbackPattern: z.string().min(1).optional()
});

export const CharacterAssetsSchema = z.object({
  avatar: z.string().min(1).optional(),
  portrait: z.string().min(1).optional()
});

export const LocationAssetsSchema = z.object({
  sceneImage: z.string().min(1).optional()
});

export const TimelineMetadataSchema = z.object({
  characterId: IdSchema.optional(),
  speakerName: z.string().min(1).optional(),
  factId: IdSchema.optional(),
  factName: z.string().min(1).optional(),
  itemId: IdSchema.optional(),
  itemName: z.string().min(1).optional(),
  locationId: IdSchema.optional(),
  locationName: z.string().min(1).optional()
}).passthrough();
```

- [ ] **Step 4: Wire visual fields into existing schemas**

Modify the same file:

```ts
export const ProfileSchema = z.object({
  id: IdSchema,
  labels: z.record(z.string(), z.string().min(1)).default({}),
  theme: ProfileThemeSchema.optional(),
  assets: ProfileAssetsSchema.optional(),
  quickActions: z.array(z.object({
    label: z.string().min(1),
    command: z.string().min(1),
    visibleWhen: ConditionSchema.optional()
  })).default([]),
  actions: z.record(z.string(), ProfileActionSchema).default({})
});
```

Add `assets: LocationAssetsSchema.optional()` to `LocationSchema`.

Add `assets: CharacterAssetsSchema.optional()` to `CharacterSchema`.

Add `metadata: TimelineMetadataSchema.optional()` to every member of `TimelineEventSchema`.

- [ ] **Step 5: Export inferred visual types**

Add these exports near the existing type exports in `packages/shared/src/domain.ts`.

```ts
export type ProfileTheme = z.infer<typeof ProfileThemeSchema>;
export type ProfileAssets = z.infer<typeof ProfileAssetsSchema>;
export type CharacterAssets = z.infer<typeof CharacterAssetsSchema>;
export type LocationAssets = z.infer<typeof LocationAssetsSchema>;
export type TimelineMetadata = z.infer<typeof TimelineMetadataSchema>;
```

- [ ] **Step 6: Run schema tests and confirm pass**

Run: `npm test -- packages/shared/src/domain.test.ts`

Expected after implementation: `domain.test.ts` passes.

- [ ] **Step 7: Commit shared contracts**

```bash
git add packages/shared/src/domain.ts packages/shared/src/domain.test.ts
git commit -m "feat: add visual contracts for story packs"
```

## Task 2: Pack Summary and Session Visual Data

**Files:**
- Modify: `packages/pack/src/listPacks.ts`
- Modify: `packages/pack/src/listPacks.test.ts`
- Modify: `apps/web/app/api/session/route.ts`
- Modify: `apps/web/app/api/session/route.test.ts`

- [ ] **Step 1: Add pack summary test coverage**

Update `writePack` in `packages/pack/src/listPacks.test.ts` to write a profile with visual fields:

```ts
  await writeFile(join(packRoot, "profile.yaml"), [
    "id: detective",
    "labels: {}",
    "theme:",
    "  tone: cool",
    "  accentColor: '#4f8cff'",
    "assets:",
    "  coverImage: generated/covers/rain-tower.webp",
    "  bannerImage: generated/banners/rain-tower.webp",
    "quickActions: []",
    "actions: {}"
  ].join("\n"));
```

Change the expected summary object to:

```ts
{
  id: "rain-tower",
  title: "Rain Tower",
  subtitle: "detective",
  introduction: "A stormy tower mystery.",
  version: "0.2.0",
  theme: {
    tone: "cool",
    accentColor: "#4f8cff"
  },
  assets: {
    coverImage: "generated/covers/rain-tower.webp",
    bannerImage: "generated/banners/rain-tower.webp"
  }
}
```

- [ ] **Step 2: Run pack listing test and verify failure**

Run: `npm test -- packages/pack/src/listPacks.test.ts`

Expected before implementation: expected `theme` and `assets` are missing from the returned summary.

- [ ] **Step 3: Include visual fields in `WorldPackSummary`**

Modify `packages/pack/src/listPacks.ts`.

```ts
import type { ProfileAssets, ProfileTheme } from "@aigame/shared";

export type WorldPackSummary = {
  id: string;
  title: string;
  subtitle: string;
  introduction: string;
  version: string;
  theme?: ProfileTheme;
  assets?: ProfileAssets;
};
```

Return `theme` and `assets` from `pack.profile`:

```ts
return {
  id: entry.name,
  title: pack.manifest.name,
  subtitle: pack.profile.id,
  introduction: summarizeWorldText(pack.worldText),
  version: pack.manifest.version,
  theme: pack.profile.theme,
  assets: pack.profile.assets
};
```

- [ ] **Step 4: Add session response test coverage**

Extend `apps/web/app/api/session/route.test.ts` assertions:

```ts
    expect(body.profile.theme).toBeDefined();
    expect(body.entities.locations[0]).toEqual(expect.objectContaining({
      id: expect.any(String),
      name: expect.any(String)
    }));
    expect(body.entities.characters[0]).toEqual(expect.objectContaining({
      id: expect.any(String),
      name: expect.any(String)
    }));
    expect(JSON.stringify(body)).not.toContain("鏈");
    expect(JSON.stringify(body)).not.toContain("鐜");
```

If the current built-in pack lacks theme data at this point, add a small theme block to `packs/rain-tower/profile.yaml` during implementation before expecting `body.profile.theme` to be defined. Use:

```yaml
theme:
  tone: cool
  accentColor: "#5f8dd3"
assets:
  fallbackPattern: rain
```

- [ ] **Step 5: Run session route test and verify failure**

Run: `npm test -- apps/web/app/api/session/route.test.ts`

Expected before implementation: mojibake assertions fail, or theme assertions fail until the route and pack data are updated.

- [ ] **Step 6: Return entity assets and readable Chinese session copy**

Modify `apps/web/app/api/session/route.ts` entity mapping:

```ts
entities: {
  locations: pack.locations.map(({ id, name, assets }) => ({ id, name, assets })),
  characters: pack.characters.map(({ id, name, assets }) => ({ id, name, assets })),
  items: pack.items.map(({ id, name }) => ({ id, name })),
  facts: pack.facts.map(({ id, name }) => ({ id, name })),
  objectives: pack.objectives.map(({ id, name, stages }) => ({ id, name, stages }))
}
```

Replace unreadable error and intro strings:

```ts
return NextResponse.json({ error: "没有找到这个故事。" }, { status: 404 });
```

```ts
const objectiveNames = pack.objectives.map((objective) => objective.name).join("、");
const locationText = entryLocation ? `当前位置是${entryLocation.name}。` : "";
const objectiveText = objectiveNames ? `目标：${objectiveNames}。` : "";
return `你进入《${pack.manifest.name}》。${worldText} ${locationText}${objectiveText}`.trim();
```

- [ ] **Step 7: Run tests and confirm pass**

Run:

```bash
npm test -- packages/pack/src/listPacks.test.ts apps/web/app/api/session/route.test.ts
```

Expected after implementation: both tests pass.

- [ ] **Step 8: Commit pack and session contract**

```bash
git add packages/pack/src/listPacks.ts packages/pack/src/listPacks.test.ts apps/web/app/api/session/route.ts apps/web/app/api/session/route.test.ts packs/rain-tower/profile.yaml
git commit -m "feat: expose story visuals to web ui"
```

## Task 3: Frontend Visual Resolver and Timeline View Models

**Files:**
- Create: `apps/web/src/components/packVisuals.ts`
- Create: `apps/web/src/components/packVisuals.test.ts`
- Modify: `apps/web/src/components/entityLabels.ts`

- [ ] **Step 1: Add visual resolver tests**

Create `apps/web/src/components/packVisuals.test.ts`.

```ts
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
```

- [ ] **Step 2: Run visual resolver tests and verify failure**

Run: `npm test -- apps/web/src/components/packVisuals.test.ts`

Expected before implementation: module `./packVisuals` is missing and entity summaries do not support assets yet.

- [ ] **Step 3: Extend entity summary types**

Modify `apps/web/src/components/entityLabels.ts`.

```ts
export type EntitySummary = {
  id: string;
  name: string;
  assets?: {
    avatar?: string;
    portrait?: string;
    sceneImage?: string;
  };
};
```

Add asset maps:

```ts
export type EntityMaps = {
  locations: Map<string, string>;
  characters: Map<string, string>;
  items: Map<string, string>;
  facts: Map<string, string>;
  objectives: Map<string, ObjectiveSummary>;
  assets: Map<string, EntitySummary["assets"]>;
};
```

Return `assets` from `buildEntityMaps`:

```ts
const allEntities = [
  ...(entities?.locations ?? []),
  ...(entities?.characters ?? []),
  ...(entities?.items ?? []),
  ...(entities?.facts ?? [])
];

return {
  locations: new Map((entities?.locations ?? []).map((entity) => [entity.id, entity.name])),
  characters: new Map((entities?.characters ?? []).map((entity) => [entity.id, entity.name])),
  items: new Map((entities?.items ?? []).map((entity) => [entity.id, entity.name])),
  facts: new Map((entities?.facts ?? []).map((entity) => [entity.id, entity.name])),
  objectives: new Map((entities?.objectives ?? []).map((entity) => [entity.id, entity])),
  assets: new Map(allEntities.map((entity) => [entity.id, entity.assets]))
};
```

- [ ] **Step 4: Implement `packVisuals.ts`**

Create `apps/web/src/components/packVisuals.ts`.

```ts
import type { CSSProperties } from "react";
import type { ProfileAssets, ProfileTheme, TimelineEvent } from "@aigame/shared";
import type { EntityMaps } from "./entityLabels";
import { labelEntity } from "./entityLabels";

export type StoryVisualSource = {
  id: string;
  title: string;
  subtitle: string;
  introduction: string;
  version: string;
  theme?: ProfileTheme;
  assets?: ProfileAssets;
};

export type StoryVisuals = {
  cssVars: CSSProperties;
  coverStyle: CSSProperties;
  tone: NonNullable<ProfileTheme["tone"]>;
  hasCoverImage: boolean;
};

export type TimelineEventViewModel = {
  id: string;
  kind: TimelineEvent["kind"];
  text: string;
  title?: string;
  avatar?: string;
  refId?: string;
};

const toneAccents: Record<NonNullable<ProfileTheme["tone"]>, string> = {
  neutral: "#6f7d8c",
  warm: "#a8643f",
  cool: "#4f8cff",
  dark: "#8a9bb8",
  light: "#52687a"
};

export function resolveStoryVisuals(story: StoryVisualSource): StoryVisuals {
  const tone = story.theme?.tone ?? "neutral";
  const accent = story.theme?.accentColor ?? toneAccents[tone];
  const background = story.theme?.backgroundColor ?? "#f4efe6";
  const text = story.theme?.textColor ?? "#211f1b";
  const hasCoverImage = Boolean(story.assets?.coverImage);

  return {
    tone,
    hasCoverImage,
    cssVars: {
      "--story-accent": accent,
      "--story-bg": background,
      "--story-text": text
    } as CSSProperties,
    coverStyle: hasCoverImage
      ? { backgroundImage: `url("${story.assets?.coverImage}")` }
      : { backgroundImage: fallbackCover(story.id, accent) }
  };
}

export function normalizeTimelineEvent(event: TimelineEvent, entityMaps: EntityMaps): TimelineEventViewModel {
  if (event.kind === "dialogue") {
    const characterId = event.metadata?.characterId ?? event.speakerId;
    return {
      id: event.id,
      kind: event.kind,
      text: event.text,
      title: event.metadata?.speakerName ?? event.speakerName ?? (characterId ? labelEntity(entityMaps.characters, characterId) : undefined),
      avatar: characterId ? entityMaps.assets.get(characterId)?.avatar : undefined,
      refId: characterId
    };
  }

  if (event.kind === "evidence") {
    const factId = event.metadata?.factId ?? event.refId;
    return {
      id: event.id,
      kind: event.kind,
      text: event.text,
      title: event.metadata?.factName ?? (factId ? labelEntity(entityMaps.facts, factId) : "发现"),
      refId: factId
    };
  }

  if (event.kind === "item") {
    const itemId = event.metadata?.itemId ?? event.refId;
    return {
      id: event.id,
      kind: event.kind,
      text: event.text,
      title: event.metadata?.itemName ?? (itemId ? labelEntity(entityMaps.items, itemId) : "物品"),
      refId: itemId
    };
  }

  if (event.kind === "location_change") {
    const locationId = event.metadata?.locationId ?? event.refId;
    return {
      id: event.id,
      kind: event.kind,
      text: event.text,
      title: event.metadata?.locationName ?? (locationId ? labelEntity(entityMaps.locations, locationId) : "地点变化"),
      refId: locationId
    };
  }

  return {
    id: event.id,
    kind: event.kind,
    text: event.text,
    refId: "refId" in event ? event.refId : undefined
  };
}

function fallbackCover(id: string, accent: string): string {
  const angle = (hashText(id) % 120) + 25;
  return `linear-gradient(${angle}deg, ${accent} 0%, #2f343a 52%, #17191d 100%)`;
}

function hashText(text: string): number {
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash;
}
```

- [ ] **Step 5: Run visual resolver tests and confirm pass**

Run: `npm test -- apps/web/src/components/packVisuals.test.ts`

Expected after implementation: tests pass.

- [ ] **Step 6: Commit visual resolver**

```bash
git add apps/web/src/components/packVisuals.ts apps/web/src/components/packVisuals.test.ts apps/web/src/components/entityLabels.ts
git commit -m "feat: resolve story visuals for web ui"
```

## Task 4: Story Library Redesign

**Files:**
- Modify: `apps/web/src/components/PackOverview.tsx`
- Create: `apps/web/src/components/PackOverview.test.tsx`
- Modify: `apps/web/app/globals.css`

- [ ] **Step 1: Add story library component tests**

Create `apps/web/src/components/PackOverview.test.tsx`.

```tsx
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PackOverview } from "./PackOverview";

describe("PackOverview", () => {
  afterEach(() => cleanup());

  it("renders the story library with readable Chinese copy", () => {
    render(<PackOverview packs={[{
      id: "campus-lunch",
      title: "午餐误会",
      subtitle: "campus",
      introduction: "午休铃声响起，错放的便当让两个人都停下了脚步。",
      version: "0.2.0"
    }]} />);

    expect(screen.getByRole("heading", { name: "故事库" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /午餐误会/ })).toBeTruthy();
    expect(screen.getByText("开始阅读")).toBeTruthy();
    expect(document.body.textContent).not.toContain("閫");
  });

  it("renders cover slots for stories with and without cover images", () => {
    render(<PackOverview packs={[
      {
        id: "mist-sect",
        title: "雾隐宗",
        subtitle: "xianxia",
        introduction: "山门之外雾气未散。",
        version: "0.2.0",
        assets: { coverImage: "generated/covers/mist-sect.webp" }
      },
      {
        id: "rain-tower",
        title: "雨塔谜案",
        subtitle: "detective",
        introduction: "暴雨夜，旧塔下传来钟声。",
        version: "0.2.0"
      }
    ]} />);

    expect(document.querySelectorAll(".story-card__cover")).toHaveLength(2);
    expect(document.querySelector("[data-has-cover='true']")).toBeTruthy();
    expect(document.querySelector("[data-has-cover='false']")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run story library tests and verify failure**

Run: `npm test -- apps/web/src/components/PackOverview.test.tsx`

Expected before implementation: heading and cover slot assertions fail.

- [ ] **Step 3: Redesign `PackOverview`**

Replace `apps/web/src/components/PackOverview.tsx` with:

```tsx
import Link from "next/link";
import type { WorldPackSummary } from "@aigame/pack";
import { resolveStoryVisuals } from "./packVisuals";

export function PackOverview({ packs }: { packs: WorldPackSummary[] }) {
  return (
    <main className="story-library">
      <header className="story-library__header">
        <div>
          <p className="eyebrow">本地故事</p>
          <h1>故事库</h1>
        </div>
        <p>{packs.length} 个可游玩的世界</p>
      </header>

      {packs.length === 0 ? (
        <section className="empty-panel" aria-label="暂无故事">
          <h2>还没有可用故事</h2>
          <p>把有效的故事包放进 packs 目录后，这里会自动出现入口。</p>
        </section>
      ) : (
        <section className="story-grid" aria-label="故事列表">
          {packs.map((pack) => {
            const visuals = resolveStoryVisuals(pack);
            return (
              <Link key={pack.id} className="story-card" href={`/play/${pack.id}`} style={visuals.cssVars} aria-label={`${pack.title}，开始阅读`}>
                <div className="story-card__cover" style={visuals.coverStyle} data-has-cover={visuals.hasCoverImage}>
                  <span>{pack.subtitle}</span>
                </div>
                <div className="story-card__body">
                  <p className="story-card__meta">{pack.subtitle} · v{pack.version}</p>
                  <h2>{pack.title}</h2>
                  <p>{pack.introduction}</p>
                  <strong>开始阅读</strong>
                </div>
              </Link>
            );
          })}
        </section>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Add library CSS hooks**

Modify `apps/web/app/globals.css` to include these class contracts. Exact color values can be adjusted in Task 7, but these selectors must exist now for tests and layout.

```css
.story-library {
  min-height: 100vh;
  width: min(1180px, 100%);
  margin: 0 auto;
  padding: 28px clamp(16px, 4vw, 44px);
}

.story-library__header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 22px;
}

.story-card {
  display: grid;
  grid-template-rows: 180px 1fr;
  overflow: hidden;
}

.story-card__cover {
  position: relative;
  background-size: cover;
  background-position: center;
}

.story-card__cover span {
  position: absolute;
  left: 12px;
  bottom: 12px;
}

.story-card__body {
  display: grid;
  gap: 10px;
  padding: 16px;
}
```

- [ ] **Step 5: Run story library tests and confirm pass**

Run: `npm test -- apps/web/src/components/PackOverview.test.tsx`

Expected after implementation: tests pass.

- [ ] **Step 6: Commit story library**

```bash
git add apps/web/src/components/PackOverview.tsx apps/web/src/components/PackOverview.test.tsx apps/web/app/globals.css
git commit -m "feat: redesign story library"
```

## Task 5: Timeline, Composer, and Sidebar Components

**Files:**
- Modify: `apps/web/src/components/TimelineEventView.tsx`
- Create: `apps/web/src/components/TimelineEventView.test.tsx`
- Modify: `apps/web/src/components/ActionComposer.tsx`
- Modify: `apps/web/src/components/StateSidebar.tsx`
- Modify: `apps/web/src/components/GameShell.tsx`
- Modify: `apps/web/src/components/GameShell.test.tsx`

- [ ] **Step 1: Add timeline renderer tests**

Create `apps/web/src/components/TimelineEventView.test.tsx`.

```tsx
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
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
```

- [ ] **Step 2: Run timeline renderer tests and verify failure**

Run: `npm test -- apps/web/src/components/TimelineEventView.test.tsx`

Expected before implementation: `TimelineEventView` does not accept `entityMaps`, avatar slots do not exist, and evidence title is not resolved.

- [ ] **Step 3: Update `TimelineEventView`**

Replace `apps/web/src/components/TimelineEventView.tsx` with:

```tsx
import type { TimelineEvent } from "@aigame/shared";
import type { EntityMaps } from "./entityLabels";
import { normalizeTimelineEvent } from "./packVisuals";

export function TimelineEventView({ event, entityMaps }: { event: TimelineEvent; entityMaps: EntityMaps }) {
  const view = normalizeTimelineEvent(event, entityMaps);

  if (view.kind === "scene") {
    return (
      <article className="timeline-event timeline-event--scene" data-event-kind={view.kind}>
        <p>{view.text}</p>
      </article>
    );
  }

  if (view.kind === "dialogue") {
    return (
      <article className="timeline-event timeline-event--dialogue" data-event-kind={view.kind}>
        <div className="timeline-event__avatar" data-has-image={Boolean(view.avatar)} style={view.avatar ? { backgroundImage: `url("${view.avatar}")` } : undefined} aria-hidden="true" />
        <div>
          <strong>{view.title}</strong>
          <p>{view.text}</p>
        </div>
      </article>
    );
  }

  if (view.kind === "player_action") {
    return (
      <article className="timeline-event timeline-event--player_action" data-event-kind={view.kind}>
        <p>{view.text}</p>
      </article>
    );
  }

  return (
    <article className={`timeline-event timeline-event--${view.kind}`} data-event-kind={view.kind}>
      {view.title ? <strong>{view.title}</strong> : null}
      <p>{view.text}</p>
    </article>
  );
}
```

- [ ] **Step 4: Update `Timeline` to pass entity maps**

Modify `apps/web/src/components/Timeline.tsx`.

```tsx
import type { TimelineEvent } from "@aigame/shared";
import type { EntityMaps } from "./entityLabels";
import { TimelineEventView } from "./TimelineEventView";

export function Timeline({ events, entityMaps }: { events: TimelineEvent[]; entityMaps: EntityMaps }) {
  return (
    <section className="timeline" aria-label="故事记录">
      {events.length === 0 ? <p className="timeline__empty">故事正在开始。</p> : null}
      {events.map((event) => (
        <TimelineEventView key={event.id} event={event} entityMaps={entityMaps} />
      ))}
    </section>
  );
}
```

- [ ] **Step 5: Update `GameShell` call site and Chinese copy**

Modify `apps/web/src/components/GameShell.tsx`:

```tsx
const WAITING_TEXT = "文字正在延展";
const READY_TEXT = "准备继续";
```

Change loading status:

```ts
setStatus("载入故事");
```

Change failure copy:

```ts
setError("没能载入这个故事。");
setStatus("连接失败");
```

Change retry status:

```ts
setStatus("请重试");
```

Change header labels:

```tsx
<p className="eyebrow">故事</p>
<h1>{session?.manifest.name ?? "载入故事"}</h1>
<dl className="game-header__meta" aria-label="故事状态">
...
<dt>回合</dt>
...
<dt>状态</dt>
```

Change timeline call:

```tsx
<Timeline events={events} entityMaps={entityMaps} />
```

- [ ] **Step 6: Update `ActionComposer` copy and retry ergonomics**

Modify `apps/web/src/components/ActionComposer.tsx` visible strings:

```tsx
aria-label="行动"
placeholder="写下你的行动"
{isSubmitting ? "继续中" : "发送"}
aria-label="快捷行动"
```

Use a textarea for better story input:

```tsx
<textarea
  aria-label="行动"
  value={input}
  onChange={(event) => onInputChange(event.target.value)}
  placeholder="写下你的行动"
  autoComplete="off"
  disabled={!isReady || isSubmitting}
  rows={2}
/>
```

Update the CSS selectors in Task 7 so `.action-row textarea` is styled with the existing input shape.

- [ ] **Step 7: Update `StateSidebar` readable copy**

Modify `apps/web/src/components/StateSidebar.tsx` defaults:

```ts
const currentLocation = state ? labelEntity(entityMaps.locations, state.currentLocationId) : "未知地点";
```

Use these empty strings:

```ts
formatList(state?.knownFacts, entityMaps.facts, "还没有发现")
formatList(state?.inventory, entityMaps.items, "暂未携带物品")
```

Fix list joiners:

```ts
return ids.map((id) => labelEntity(map, id)).join("、");
```

Objective empty text:

```ts
if (rows.length === 0) return "目标尚未展开";
```

Objective joiner:

```ts
.join("、");
```

- [ ] **Step 8: Update component tests for real Chinese copy**

Modify `apps/web/src/components/GameShell.test.tsx` so the session body uses readable Chinese labels and assertions:

```ts
labels: {
  location: "地点",
  facts: "发现",
  inventory: "物品",
  objectives: "进展"
}
```

Update assertions:

```ts
expect(screen.getByPlaceholderText("写下你的行动")).toBeTruthy();
expect(screen.getByRole("button", { name: "发送" })).toBeTruthy();
expect(screen.queryByText("Runtime")).toBeNull();
expect(document.body.textContent).not.toContain("閫");
```

Update quick action text:

```ts
{ label: "环顾四周", command: "look" }
{ label: "指认管家", command: "confront butler", visibleWhen: { factKnown: "butler_motive" } }
```

Update submitted text:

```ts
fireEvent.change(screen.getByPlaceholderText("写下你的行动"), { target: { value: "询问林同学" } });
fireEvent.click(screen.getByRole("button", { name: "发送" }));
```

- [ ] **Step 9: Run focused component tests and confirm pass**

Run:

```bash
npm test -- apps/web/src/components/TimelineEventView.test.tsx apps/web/src/components/GameShell.test.tsx
```

Expected after implementation: tests pass.

- [ ] **Step 10: Commit reader components**

```bash
git add apps/web/src/components/Timeline.tsx apps/web/src/components/TimelineEventView.tsx apps/web/src/components/TimelineEventView.test.tsx apps/web/src/components/ActionComposer.tsx apps/web/src/components/StateSidebar.tsx apps/web/src/components/GameShell.tsx apps/web/src/components/GameShell.test.tsx
git commit -m "feat: redesign immersive reader components"
```

## Task 6: Player-Safe Stream and Server Copy

**Files:**
- Modify: `apps/web/src/components/turnStream.ts`
- Modify: `apps/web/src/components/turnStream.test.ts`
- Modify: `apps/web/src/server/turnService.ts`
- Modify: `apps/web/app/api/turn/stream/route.ts`

- [ ] **Step 1: Update stream client tests**

Modify `apps/web/src/components/turnStream.test.ts`.

Use readable test strings:

```ts
const response = streamResponse([
  "event: status\ndata: {\"message\":\"行动已接收\"}\n\n",
  "event: res",
  "ult\ndata: {\"outputText\":\"管家避开了你的目光。\"}\n\n"
]);
```

Expect:

```ts
expect(statuses).toEqual(["行动已接收"]);
expect(result.outputText).toBe("管家避开了你的目光。");
```

Update internal mapping test:

```ts
const response = streamResponse([
  "event: status\ndata: {\"message\":\"正在调用模型...\"}\n\n",
  "event: result\ndata: {\"outputText\":\"done\"}\n\n"
]);

expect(statuses).toEqual(["文字正在延展"]);
```

Update error test:

```ts
"event: error\ndata: {\"message\":\"模型返回内容不完整，请重试。\"}\n\n"
await expect(readTurnEventStream(response, {})).rejects.toThrow("模型返回内容不完整，请重试。");
```

- [ ] **Step 2: Run stream tests and verify failure**

Run: `npm test -- apps/web/src/components/turnStream.test.ts`

Expected before implementation: status mapping still returns old unreadable copy.

- [ ] **Step 3: Replace stream status mapping**

Modify `apps/web/src/components/turnStream.ts`.

```ts
function playerSafeStatus(message: string): string {
  const statusLabels: Record<string, string> = {
    pending: "文字正在延展",
    running: "文字正在延展",
    complete: "故事已记录",
    "正在调用模型...": "文字正在延展",
    "正在写入案卷...": "故事已记录",
    "行动已记录，正在思考...": "文字正在延展"
  };

  return statusLabels[message] ?? message;
}
```

Change fallback error:

```ts
return data || "行动处理失败。";
```

- [ ] **Step 4: Replace server-side status and failure copy**

Modify `apps/web/src/server/turnService.ts`.

```ts
onStatus?.("文字正在延展");
...
onStatus?.("故事已记录");
```

Replace `formatTurnFailure` strings:

```ts
error: "模型返回内容不完整，刚才的行动没有生效；请重试。"
```

```ts
error: "模型服务暂时不可用，刚才的行动没有生效；请稍后重试。"
```

```ts
error: "模型没有配置：请设置 DEEPSEEK_API_KEY，或显式设置 AIGAME_MODEL_PROVIDER=fake 进入测试模式。"
```

```ts
error: "行动处理失败，刚才的行动没有生效；请重试。"
```

Modify `apps/web/app/api/turn/stream/route.ts` initial status:

```ts
send("status", { message: "文字正在延展" });
```

- [ ] **Step 5: Run stream and turn route tests**

Run:

```bash
npm test -- apps/web/src/components/turnStream.test.ts apps/web/app/api/turn/stream/route.test.ts
```

Expected after implementation: tests pass or route tests only need expected copy updates to the same strings above.

- [ ] **Step 6: Commit player-safe stream copy**

```bash
git add apps/web/src/components/turnStream.ts apps/web/src/components/turnStream.test.ts apps/web/src/server/turnService.ts apps/web/app/api/turn/stream/route.ts apps/web/app/api/turn/stream/route.test.ts
git commit -m "fix: use player-safe stream copy"
```

## Task 7: Immersive Responsive CSS

**Files:**
- Modify: `apps/web/app/globals.css`

- [ ] **Step 1: Add CSS acceptance checks to Playwright**

Modify `apps/web/tests/player.spec.ts` after Task 8's readable copy updates, adding:

```ts
test("uses immersive reader layout without broken visual slots", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".story-card__cover").first()).toBeVisible();

  await page.getByRole("link", { name: /雨塔谜案/ }).click();
  await expect(page.locator(".game-shell")).toBeVisible();
  await expect(page.locator(".timeline")).toBeVisible();
  await expect(page.locator(".action-composer")).toBeVisible();
  await expect(page.locator(".state-sidebar")).toBeVisible();
});
```

- [ ] **Step 2: Run browser test and verify failure**

Run: `npm run e2e -- apps/web/tests/player.spec.ts`

Expected before final CSS and test copy updates: selectors or readable text assertions fail.

- [ ] **Step 3: Replace global CSS with the neutral story-reader system**

Update `apps/web/app/globals.css` around the existing variables and component selectors. Preserve existing class names that components still use.

```css
:root {
  color-scheme: light;
  --page-bg: #f3efe7;
  --reader-bg: #fffaf1;
  --surface: #ffffff;
  --surface-2: #f0f3f6;
  --ink: #24211d;
  --muted: #6f6a62;
  --line: rgba(36, 33, 29, 0.14);
  --accent: #52687a;
  --accent-strong: #2f5068;
  --danger: #a94b43;
  --success: #557a51;
  --discovery: #8a693a;
}

body {
  margin: 0;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.58), rgba(255, 255, 255, 0)),
    var(--page-bg);
  color: var(--ink);
  font-family: "Noto Sans SC", "Microsoft YaHei", "PingFang SC", Inter, system-ui, sans-serif;
}

.story-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
}

.story-card {
  min-height: 360px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
  box-shadow: 0 16px 40px rgba(39, 34, 28, 0.08);
}

.game-shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 340px);
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 16px;
  padding: 18px;
}

.game-header {
  grid-column: 1 / -1;
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid var(--line);
  padding-bottom: 14px;
}

.timeline {
  min-height: 0;
  overflow: auto;
  display: grid;
  align-content: start;
  gap: 14px;
  border-radius: 8px;
  background: var(--reader-bg);
  padding: clamp(16px, 3vw, 28px);
}

.timeline-event {
  width: min(760px, 100%);
  border-radius: 8px;
  color: var(--ink);
}

.timeline-event--scene {
  border: 0;
  background: transparent;
  padding: 0;
  font-size: 1.02rem;
}

.timeline-event--dialogue {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr);
  gap: 12px;
  border: 1px solid var(--line);
  background: var(--surface);
  padding: 13px 14px;
}

.timeline-event__avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(145deg, var(--story-accent, var(--accent)), #d7dde3);
  background-size: cover;
  background-position: center;
}

.timeline-event--player_action {
  margin-left: auto;
  border: 1px solid rgba(82, 104, 122, 0.28);
  background: #eef3f7;
  padding: 9px 12px;
}

.timeline-event--evidence,
.timeline-event--item,
.timeline-event--progress,
.timeline-event--location_change,
.timeline-event--notice {
  border: 1px solid var(--line);
  background: var(--surface);
  padding: 12px 14px;
}

.timeline-event--evidence,
.timeline-event--item {
  border-color: rgba(138, 105, 58, 0.38);
}

.action-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 86px;
  gap: 10px;
}

.action-row textarea {
  min-height: 54px;
  resize: vertical;
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--surface);
  color: var(--ink);
  padding: 10px 12px;
}

@media (max-width: 900px) {
  .game-shell {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(360px, 1fr) auto auto;
  }

  .game-header,
  .action-composer,
  .debug-drawer {
    grid-column: 1;
  }

  .state-sidebar {
    grid-row: 3;
  }
}

@media (max-width: 560px) {
  .story-library,
  .game-shell {
    padding: 12px;
  }

  .action-row {
    grid-template-columns: 1fr;
  }
}
```

Keep or adapt existing selectors for `.state-sidebar`, `.debug-drawer`, `.quick-actions`, `.notice`, `button`, `textarea`, and focus states so the app remains usable.

- [ ] **Step 4: Verify CSS does not create a one-note palette**

Run:

```bash
rg -n "#|rgb|hsl|linear-gradient" apps/web/app/globals.css
```

Expected: palette includes neutral paper, white surfaces, blue-gray accent, warm discovery color, and danger/success colors. It should not read as all purple, beige, dark blue, or brown.

- [ ] **Step 5: Commit CSS**

```bash
git add apps/web/app/globals.css apps/web/tests/player.spec.ts
git commit -m "style: add immersive story reader visual system"
```

## Task 8: Browser Acceptance and Mojibake Cleanup

**Files:**
- Modify: `apps/web/tests/player.spec.ts`
- Modify: any component, route, or pack file that still exposes mojibake in player-facing UI.

- [ ] **Step 1: Replace Playwright copy with readable Chinese**

Modify `apps/web/tests/player.spec.ts`.

Use these assertions:

```ts
await expect(page.getByRole("heading", { name: "故事库" })).toBeVisible();
await expect(page.getByRole("link", { name: /雨塔谜案/ })).toBeVisible();
...
await expect(page.getByPlaceholder("写下你的行动")).toBeVisible();
await expect(page.getByText("正在调用模型")).not.toBeVisible();
await expect(page.getByText("Runtime")).not.toBeVisible();
await expect(page.getByRole("button", { name: "指认管家" })).not.toBeVisible();
```

Update mocked session body in the event-type test with readable Chinese:

```ts
manifest: {
  id: "rain-tower",
  name: "雨塔谜案",
  version: "0.2.0",
  runtimeVersion: "0.2.0",
  entryLocationId: "foyer",
  profileId: "detective"
},
profile: {
  id: "detective",
  labels: { location: "地点", facts: "线索", inventory: "物品", objectives: "进展" },
  theme: { tone: "cool", accentColor: "#5f8dd3" },
  assets: { fallbackPattern: "rain" },
  quickActions: [],
  actions: {}
},
entities: {
  locations: [{ id: "foyer", name: "门厅" }],
  characters: [{ id: "butler", name: "管家", assets: { avatar: "generated/avatars/butler.webp" } }],
  items: [],
  facts: [{ id: "butler_kitchen", name: "厨房证词" }],
  objectives: [{ id: "solve_murder", name: "查明真相", stages: ["investigate"] }]
},
intro: "雨声压低了所有人的声音。",
```

Update mocked timeline:

```ts
timelineEvents: [
  { id: "evt_1", kind: "player_action", actorId: "player", text: "询问管家", timestamp: "2026-05-29T12:00:00.000Z", visibleToPlayer: true },
  { id: "evt_2", kind: "dialogue", speakerId: "butler", speakerName: "管家", text: "我一直在厨房。", timestamp: "2026-05-29T12:00:00.000Z", visibleToPlayer: true },
  { id: "evt_3", kind: "evidence", refId: "butler_kitchen", text: "管家声称自己整晚在厨房。", timestamp: "2026-05-29T12:00:00.000Z", visibleToPlayer: true }
]
```

- [ ] **Step 2: Scan for mojibake in player-facing web files**

Run:

```bash
rg -n "閫|妗|鐜|鎬|璇|绾|銆|€|锛|涓|姝|杈|鍙" apps/web packages shared packs/rain-tower
```

Expected before cleanup: matches exist in web components, tests, server copy, or Rain Tower pack text.

- [ ] **Step 3: Replace only player-facing mojibake touched by this UI**

Update matched strings in:

- `apps/web/src/components/*.tsx`
- `apps/web/src/components/*.test.tsx`
- `apps/web/src/components/turnStream.ts`
- `apps/web/src/components/turnStream.test.ts`
- `apps/web/src/server/turnService.ts`
- `apps/web/app/api/session/route.ts`
- `apps/web/app/api/turn/stream/route.ts`
- `apps/web/tests/player.spec.ts`

Use the copy defined in Tasks 2, 5, 6, and 8. Do not rewrite unrelated pack story prose unless it appears in visible acceptance tests.

- [ ] **Step 4: Run browser tests and confirm pass**

Run: `npm run e2e -- apps/web/tests/player.spec.ts`

Expected after implementation: story library, selected play route, typed event selectors, hidden runtime copy, and visual-slot selectors pass.

- [ ] **Step 5: Commit browser acceptance cleanup**

```bash
git add apps/web/tests/player.spec.ts apps/web/src/components apps/web/src/server/turnService.ts apps/web/app/api/session/route.ts apps/web/app/api/turn/stream/route.ts
git commit -m "test: verify immersive story reader flow"
```

## Task 9: Full Verification

**Files:**
- Modify only files needed to fix failures caused by Tasks 1-8.

- [ ] **Step 1: Run typecheck**

Run: `npm run typecheck`

Expected: exits `0`.

- [ ] **Step 2: Run unit tests**

Run: `npm test`

Expected: exits `0`.

- [ ] **Step 3: Run browser tests**

Run: `npm run e2e`

Expected: exits `0`.

- [ ] **Step 4: Run web build**

Run: `npm run web:build`

Expected: exits `0`.

- [ ] **Step 5: Start the local app for manual inspection**

Run: `npm run web:start`

Expected: app starts at `http://127.0.0.1:3000`.

- [ ] **Step 6: Manual acceptance checklist**

- [ ] `/` shows `故事库`.
- [ ] Story cards have cover slots and readable title/summary/version/start action.
- [ ] `/play/rain-tower` shows a neutral story reader layout.
- [ ] Timeline events distinguish scene, dialogue, player action, evidence, item, progress, location changes, and notices.
- [ ] Dialogue rows reserve avatar space.
- [ ] State sidebar uses readable labels and does not expose raw ids when labels exist.
- [ ] Action composer says `写下你的行动` and `发送`.
- [ ] Failed turn keeps the typed input.
- [ ] Normal play does not show `Runtime`, provider/model names, trace JSON, or mojibake text.
- [ ] Missing cover/avatar/scene assets still produce complete visual slots.

- [ ] **Step 7: Commit verification fixes**

Only run this commit if verification required fixes:

```bash
git add <fixed-files>
git commit -m "fix: complete immersive story ui verification"
```

## Execution Order

1. Task 1: shared visual contracts.
2. Task 2: pack summaries and session visual data.
3. Task 3: frontend visual resolver and timeline view models.
4. Task 4: story library redesign.
5. Task 5: timeline, composer, and sidebar components.
6. Task 6: player-safe stream and server copy.
7. Task 7: immersive responsive CSS.
8. Task 8: browser acceptance and mojibake cleanup.
9. Task 9: full verification.

## Risk Controls

- Do not implement AIGC image generation in this plan.
- Do not add a heavy UI framework.
- Do not remove SQLite or JSONL session behavior.
- Do not rewrite unrelated runtime semantics.
- Do not show debug events in the normal timeline.
- Do not rely on display names for runtime logic.
- Do not hide layout gaps by removing asset slots; fallback visuals must preserve stable dimensions.
- Do not overwrite the pre-existing untracked file `docs/superpowers/plans/2026-05-28-player-experience-overhaul.md`.

