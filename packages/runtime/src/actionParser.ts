import type { GameAction } from "@aigame/shared";

export interface ActionLexicon {
  locations?: Array<{ id: string; name?: string; aliases?: string[] }>;
  npcs?: Array<{
    id: string;
    name?: string;
    aliases?: string[];
    topics?: Array<{ id: string; prompt?: string; aliases?: string[] }>;
  }>;
  items?: Array<{ id: string; name?: string; aliases?: string[] }>;
  clues?: Array<{ id: string; name?: string; aliases?: string[] }>;
}

export function parseAction(inputText: string, lexicon: ActionLexicon = {}): GameAction {
  const rawText = inputText.trim();
  const [verb, first, ...rest] = rawText.split(/\s+/);

  if (!verb || verb === "look") return { type: "look", rawText };
  if ((verb === "go" || verb === "move") && first) return { type: "move", locationId: first, rawText };
  if ((verb === "inspect" || verb === "examine") && first) return { type: "inspect", targetId: first, rawText };
  if (verb === "ask" && first) return { type: "ask", npcId: first, topic: rest.join(" "), rawText };
  if ((verb === "take" || verb === "pickup" || verb === "get") && first) return { type: "take", itemId: first, rawText };
  if (verb === "use" && first) return { type: "use", itemId: first, targetId: rest[1], rawText };
  if (verb === "accuse" && first) {
    const withIndex = rest.indexOf("with");
    const clueIds = withIndex >= 0 ? rest.slice(withIndex + 1) : [];
    return { type: "accuse", npcId: first, clueIds, rawText };
  }

  const naturalAction = parseNaturalAction(rawText, lexicon);
  if (naturalAction) return naturalAction;

  return { type: "unknown", rawText };
}

function parseNaturalAction(rawText: string, lexicon: ActionLexicon): GameAction | undefined {
  const npc = findMention(rawText, lexicon.npcs ?? []);
  const item = findMention(rawText, lexicon.items ?? []);
  const clue = findMention(rawText, lexicon.clues ?? []);
  const location = findMention(rawText, lexicon.locations ?? []);

  if (hasAny(rawText, ["询问", "问", "追问", "盘问", "问问"]) && npc) {
    return {
      type: "ask",
      npcId: npc.entity.id,
      topic: matchTopic(rawText, npc.entity.topics ?? []) ?? inferTopic(rawText, npc.matchedText),
      rawText
    };
  }

  if (hasAny(rawText, ["拿走", "拿起", "拾取", "捡起", "带走", "收起", "获得", "取走"]) && item) {
    return { type: "take", itemId: item.entity.id, rawText };
  }

  if (hasAny(rawText, ["检查", "查看", "观察", "调查", "检视", "看看", "看"]) && (item || clue)) {
    return { type: "inspect", targetId: (item ?? clue)?.entity.id ?? "", rawText };
  }

  if (hasAny(rawText, ["前往", "去", "移动到", "进入", "走到"]) && location) {
    return { type: "move", locationId: location.entity.id, rawText };
  }

  return undefined;
}

function findMention<T extends { id: string; name?: string; aliases?: string[] }>(
  rawText: string,
  entities: T[]
): { entity: T; matchedText: string } | undefined {
  const normalizedText = normalizeText(rawText);
  const candidates = entities
    .flatMap((entity) => mentionTexts(entity).map((text) => ({ entity, text })))
    .filter((candidate) => candidate.text.length > 0)
    .sort((left, right) => right.text.length - left.text.length);

  const match = candidates.find((candidate) => normalizedText.includes(normalizeText(candidate.text)));
  return match ? { entity: match.entity, matchedText: match.text } : undefined;
}

function mentionTexts(entity: { id: string; name?: string; aliases?: string[] }): string[] {
  return [entity.id, entity.name, ...(entity.aliases ?? [])].filter((value): value is string => Boolean(value));
}

function matchTopic(rawText: string, topics: Array<{ id: string; prompt?: string; aliases?: string[] }>): string | undefined {
  const normalizedText = normalizeText(rawText);
  const match = topics.find((topic) =>
    [topic.id, topic.prompt, ...(topic.aliases ?? [])]
      .filter((value): value is string => Boolean(value))
      .some((candidate) => normalizedText.includes(normalizeText(candidate)))
  );
  return match?.id;
}

function inferTopic(rawText: string, matchedEntity: string): string {
  const stripped = rawText
    .replace(matchedEntity, "")
    .replace(/[，。、“”"']/g, " ")
    .replace(/询问|追问|盘问|问问|问/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped || "general";
}

function hasAny(rawText: string, terms: string[]): boolean {
  return terms.some((term) => rawText.includes(term));
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "");
}
