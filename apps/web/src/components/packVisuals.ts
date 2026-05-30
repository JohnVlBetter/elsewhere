import type { CSSProperties } from "react";
import type { TimelineEvent } from "@aigame/shared";
import type { EntityMaps } from "./entityLabels";
import { labelEntity } from "./entityLabels";

type StoryTone = "neutral" | "warm" | "cool" | "dark" | "light";

type StoryTheme = {
  tone?: StoryTone;
  accentColor?: string;
  backgroundColor?: string;
  textColor?: string;
};

type StoryAssets = {
  coverImage?: string;
  bannerImage?: string;
  fallbackPattern?: string;
};

type TimelineMetadata = {
  characterId?: string;
  speakerName?: string;
  factId?: string;
  factName?: string;
  itemId?: string;
  itemName?: string;
  locationId?: string;
  locationName?: string;
  messageType?: string;
};

type NormalizableTimelineEvent = TimelineEvent & {
  metadata?: TimelineMetadata;
  speakerId?: string;
  speakerName?: string;
  refId?: string;
};

export type StoryVisualSource = {
  id: string;
  title: string;
  subtitle: string;
  introduction: string;
  version: string;
  theme?: StoryTheme;
  assets?: StoryAssets;
};

export type StoryVisuals = {
  cssVars: CSSProperties & Record<"--story-accent" | "--story-bg" | "--story-text", string>;
  coverStyle: CSSProperties;
  bannerStyle: CSSProperties;
  tone: StoryTone;
  hasCoverImage: boolean;
  hasBannerImage: boolean;
};

export type TimelineEventViewModel = {
  id: string;
  kind: TimelineEvent["kind"];
  text: string;
  title?: string;
  avatar?: string;
  refId?: string;
  role?: string;
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
  const coverImage = story.assets?.coverImage ? cssUrl(story.assets.coverImage) : undefined;
  const bannerImage = story.assets?.bannerImage ? cssUrl(story.assets.bannerImage) : undefined;
  const fallbackPattern = story.assets?.fallbackPattern ? cssUrl(story.assets.fallbackPattern) : undefined;
  const fallbackImage = fallbackPattern ?? `linear-gradient(135deg, ${background} 0%, ${accent} 100%)`;

  return {
    cssVars: {
      "--story-accent": accent,
      "--story-bg": background,
      "--story-text": text
    },
    coverStyle: {
      backgroundImage: coverImage ?? fallbackImage
    },
    bannerStyle: {
      backgroundImage: bannerImage ?? coverImage ?? fallbackImage
    },
    tone,
    hasCoverImage: Boolean(coverImage),
    hasBannerImage: Boolean(bannerImage)
  };
}

export function cssUrl(value: string): string | undefined {
  const normalized = normalizeAssetUrl(value);
  return normalized ? `url("${escapeCssQuotedUrl(normalized)}")` : undefined;
}

function escapeCssQuotedUrl(url: string): string {
  return url.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
}

function normalizeAssetUrl(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed || /[\u0000-\u001f\u007f]/.test(trimmed)) return undefined;

  const slashPath = trimmed.replace(/\\/g, "/");
  if (slashPath.startsWith("//")) return undefined;

  try {
    const url = new URL(slashPath);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.href;
    }
    return undefined;
  } catch {
    // Local asset path; validate below.
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(slashPath)) return undefined;

  const relativePath = slashPath.replace(/^\.\/+/, "");
  if (!relativePath || relativePath.split("/").some((part) => part === "..")) return undefined;

  const absolutePath = relativePath.startsWith("/") ? relativePath : `/${relativePath}`;
  return encodeURI(absolutePath)
    .replace(/"/g, "%22")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29");
}

export function normalizeTimelineEvent(event: NormalizableTimelineEvent, entityMaps: EntityMaps): TimelineEventViewModel {
  const base = {
    id: event.id,
    kind: event.kind,
    text: event.text,
    role: typeof event.metadata?.messageType === "string" ? event.metadata.messageType : undefined
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

  if (event.kind === "relationship") {
    return {
      ...base,
      title: "关系变化",
      refId: "refId" in event ? event.refId : undefined
    };
  }

  if (event.kind === "resource") {
    return {
      ...base,
      title: "状态变化",
      refId: "refId" in event ? event.refId : undefined
    };
  }

  return {
    ...base,
    refId: "refId" in event ? event.refId : undefined
  };
}
