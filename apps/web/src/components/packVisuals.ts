import type { CSSProperties } from "react";
import type { ProfileAssets, ProfileTheme, TimelineEvent } from "@aigame/shared";
import type { EntityMaps } from "./entityLabels";
import { labelEntity } from "./entityLabels";

type StoryTone = NonNullable<ProfileTheme["tone"]>;

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
  cssVars: CSSProperties & Record<"--story-accent" | "--story-bg" | "--story-text", string>;
  coverStyle: CSSProperties;
  tone: StoryTone;
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

const DEFAULT_TONE: StoryTone = "neutral";
const DEFAULT_BACKGROUND = "#f4efe6";
const DEFAULT_TEXT = "#211f1b";

const ACCENTS: Record<StoryTone, string> = {
  neutral: "#6d5f4f",
  warm: "#b85c38",
  cool: "#4f8cff",
  dark: "#9ab3ff",
  light: "#6b8f3f"
};

export function resolveStoryVisuals(story: StoryVisualSource): StoryVisuals {
  const tone = story.theme?.tone ?? DEFAULT_TONE;
  const accent = story.theme?.accentColor ?? ACCENTS[tone];
  const background = story.theme?.backgroundColor ?? DEFAULT_BACKGROUND;
  const text = story.theme?.textColor ?? DEFAULT_TEXT;
  const coverImage = story.assets?.coverImage;

  return {
    cssVars: {
      "--story-accent": accent,
      "--story-bg": background,
      "--story-text": text
    },
    coverStyle: {
      backgroundImage: coverImage
        ? `url("${coverImage}")`
        : `linear-gradient(135deg, ${background} 0%, ${accent} 100%)`
    },
    tone,
    hasCoverImage: Boolean(coverImage)
  };
}

export function normalizeTimelineEvent(event: TimelineEvent, entityMaps: EntityMaps): TimelineEventViewModel {
  const base = {
    id: event.id,
    kind: event.kind,
    text: event.text
  };

  if (event.kind === "dialogue") {
    const characterId = event.metadata?.characterId ?? event.speakerId;

    return {
      ...base,
      title: event.metadata?.speakerName ?? event.speakerName ?? labelEntity(entityMaps.characters, characterId),
      avatar: entityMaps.assets.get(characterId)?.avatar
    };
  }

  if (event.kind === "evidence") {
    const factId = event.metadata?.factId ?? event.refId;

    return {
      ...base,
      title: event.metadata?.factName ?? (factId ? labelEntity(entityMaps.facts, factId) : "发现"),
      refId: factId
    };
  }

  if (event.kind === "item") {
    const itemId = event.metadata?.itemId ?? event.refId;

    return {
      ...base,
      title: event.metadata?.itemName ?? (itemId ? labelEntity(entityMaps.items, itemId) : "物品"),
      refId: itemId
    };
  }

  if (event.kind === "location_change") {
    const locationId = event.metadata?.locationId ?? event.refId;

    return {
      ...base,
      title: event.metadata?.locationName ?? (locationId ? labelEntity(entityMaps.locations, locationId) : "地点变化"),
      refId: locationId
    };
  }

  return {
    ...base,
    refId: "refId" in event ? event.refId : undefined
  };
}
