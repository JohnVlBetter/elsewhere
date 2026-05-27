import type { GameAction, Profile } from "@aigame/shared";

export interface ActionLexicon {
  profile?: Profile;
  locations?: Array<{ id: string; name?: string; aliases?: string[] }>;
  characters?: Array<{
    id: string;
    name?: string;
    aliases?: string[];
    topics?: Array<{ id: string; prompt?: string; aliases?: string[] }>;
  }>;
  items?: Array<{ id: string; name?: string; aliases?: string[] }>;
  facts?: Array<{ id: string; name?: string; aliases?: string[] }>;
  lastInterlocutorId?: string;
  visibleCharacterIds?: string[];
  visibleObjectIds?: string[];
  aliases?: Array<{ id: string; names: string[] }>;
}

export function parseAction(inputText: string, lexicon: ActionLexicon = {}): GameAction {
  const rawText = inputText.trim();
  const [verb, first, ...rest] = rawText.split(/\s+/);

  if (!verb || verb === "look") return { type: "look", rawText };
  if ((verb === "go" || verb === "move") && first) return { type: "move", locationId: first, rawText };
  if ((verb === "inspect" || verb === "examine") && first) return { type: "inspect", targetId: first, rawText };
  if ((verb === "talk" || verb === "ask") && first) return parseTalkCommand(first, rest, rawText);
  if ((verb === "take" || verb === "pickup" || verb === "get") && first) return { type: "take", itemId: first, rawText };
  if (verb === "use" && first) return { type: "use", itemId: first, targetId: rest[1], rawText };
  if (verb === "act" && first) return parseActCommand(first, rest, rawText);

  const profileAction = findProfileActionByVerb(verb, lexicon.profile);
  if (profileAction) {
    return parseActCommand(profileAction.intent, [first, ...rest].filter(Boolean), rawText);
  }

  const naturalAction = parseNaturalAction(rawText, lexicon);
  if (naturalAction) return naturalAction;

  return { type: "unknown", rawText };
}

function parseTalkCommand(characterId: string, rest: string[], rawText: string): GameAction {
  const aboutIndex = rest.indexOf("about");
  const topicParts = aboutIndex >= 0 ? rest.slice(aboutIndex + 1) : rest;
  return { type: "talk", characterId, topic: topicParts.join(" ") || "general", rawText };
}

function parseActCommand(intent: string, rest: string[], rawText: string): GameAction {
  const withIndex = rest.indexOf("with");
  const targetParts = withIndex >= 0 ? rest.slice(0, withIndex) : rest;
  const factIds = withIndex >= 0 ? rest.slice(withIndex + 1).filter(Boolean) : [];
  const targetId = targetParts[0];

  return targetId
    ? { type: "act", intent, targetId, factIds, rawText }
    : { type: "act", intent, factIds, rawText };
}

function parseNaturalAction(rawText: string, lexicon: ActionLexicon): GameAction | undefined {
  const character = findMention(rawText, lexicon.characters ?? []);
  const item = findMention(rawText, lexicon.items ?? []);
  const fact = findMention(rawText, lexicon.facts ?? []);
  const location = findMention(rawText, lexicon.locations ?? []);
  const groupTalk = parseGroupTalk(rawText);
  if (groupTalk) return groupTalk;

  if (hasAny(rawText, ["询问", "问", "追问", "盘问", "请教"]) && character) {
    return {
      type: "talk",
      characterId: character.entity.id,
      topic: matchTopic(rawText, character.entity.topics ?? []) ?? inferTopic(rawText, character.matchedText),
      rawText
    };
  }

  if (looksLikeTargetlessQuestion(rawText) && lexicon.lastInterlocutorId && lexicon.visibleCharacterIds?.includes(lexicon.lastInterlocutorId)) {
    return {
      type: "talk",
      characterId: lexicon.lastInterlocutorId,
      targetId: lexicon.lastInterlocutorId,
      topic: inferTargetlessTopic(rawText),
      rawText
    };
  }

  if (hasAny(rawText, ["拿走", "拿起", "拾取", "捡起", "带走", "收起", "获得", "取走"]) && item) {
    return { type: "take", itemId: item.entity.id, rawText };
  }

  if (hasAny(rawText, ["检查", "查看", "观察", "调查", "检视", "看看", "看"]) && (item || fact)) {
    return { type: "inspect", targetId: (item ?? fact)?.entity.id ?? "", rawText };
  }

  if (hasAny(rawText, ["前往", "去", "移动到", "进入", "走到"]) && location) {
    return { type: "move", locationId: location.entity.id, rawText };
  }

  const profileAction = findProfileActionInText(rawText, lexicon.profile);
  if (profileAction) {
    return buildNaturalActAction(rawText, profileAction, lexicon, { character, item, fact, location });
  }

  const visibleAlias = findVisibleAlias(rawText, lexicon);
  if (visibleAlias) {
    return { type: "inspect", targetId: visibleAlias, query: normalizeText(rawText), rawText };
  }

  return undefined;
}

function parseGroupTalk(rawText: string): GameAction | undefined {
  const normalized = normalizeText(rawText);
  const talkPrefix = ["询问", "问", "追问", "盘问", "ask"].find((term) => normalized.startsWith(normalizeText(term)));
  if (!talkPrefix) return undefined;

  const groupTerm = ["众人", "大家", "所有人", "在场的人", "everyone", "all"].find((term) =>
    normalized.includes(normalizeText(term))
  );
  if (!groupTerm) return undefined;

  const topic = rawText
    .replace(new RegExp(`^\\s*${escapeRegExp(talkPrefix)}\\s*`), "")
    .replace(groupTerm, "")
    .replace(/^(关于|有关|就|about)\s*/i, "")
    .trim();

  return { type: "group_talk", topic: topic || undefined, rawText };
}

function looksLikeTargetlessQuestion(rawText: string): boolean {
  return hasAny(rawText, ["继续问", "追问", "询问", "问他", "问她", "问", "哪里", "什么", "为何", "怎么", "?", "？"]);
}

function inferTargetlessTopic(rawText: string): string {
  const topic = rawText
    .replace(/继续问|追问|询问|问他|问她|问/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return topic || "general";
}

function findVisibleAlias(rawText: string, lexicon: ActionLexicon): string | undefined {
  const normalized = normalizeText(rawText);
  return lexicon.aliases?.find((alias) =>
    lexicon.visibleObjectIds?.includes(alias.id) &&
    alias.names.some((name) => normalizeText(name) === normalized)
  )?.id;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildNaturalActAction(
  rawText: string,
  profileAction: { intent: string; acceptsFacts: boolean; requiresTarget?: string },
  lexicon: ActionLexicon,
  mentions: {
    character?: Mention<{ id: string; name?: string; aliases?: string[] }>;
    item?: Mention<{ id: string; name?: string; aliases?: string[] }>;
    fact?: Mention<{ id: string; name?: string; aliases?: string[] }>;
    location?: Mention<{ id: string; name?: string; aliases?: string[] }>;
  }
): GameAction {
  const targetId = pickTargetId(profileAction.requiresTarget, mentions);
  const factIds = profileAction.acceptsFacts
    ? findAllMentions(rawText, lexicon.facts ?? []).map((match) => match.entity.id)
    : [];

  return targetId
    ? { type: "act", intent: profileAction.intent, targetId, factIds, rawText }
    : { type: "act", intent: profileAction.intent, factIds, rawText };
}

type Mention<T extends { id: string; name?: string; aliases?: string[] }> = { entity: T; matchedText: string };

function findMention<T extends { id: string; name?: string; aliases?: string[] }>(
  rawText: string,
  entities: T[]
): Mention<T> | undefined {
  return findAllMentions(rawText, entities)[0];
}

function findAllMentions<T extends { id: string; name?: string; aliases?: string[] }>(
  rawText: string,
  entities: T[]
): Array<Mention<T>> {
  const normalizedText = normalizeText(rawText);
  const candidates = entities
    .flatMap((entity) => mentionTexts(entity).map((text) => ({ entity, text })))
    .filter((candidate) => candidate.text.length > 0)
    .sort((left, right) => right.text.length - left.text.length);
  const seen = new Set<string>();
  const matches: Array<Mention<T>> = [];

  for (const candidate of candidates) {
    if (seen.has(candidate.entity.id)) continue;
    if (normalizedText.includes(normalizeText(candidate.text))) {
      matches.push({ entity: candidate.entity, matchedText: candidate.text });
      seen.add(candidate.entity.id);
    }
  }

  return matches;
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
    .replace(/[，。、"'“”]/g, " ")
    .replace(/询问|追问|盘问|请教|问/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped || "general";
}

function findProfileActionByVerb(verb: string, profile: Profile | undefined): { intent: string } | undefined {
  if (!profile) return undefined;
  const normalizedVerb = normalizeText(verb);
  for (const [intent, action] of Object.entries(profile.actions)) {
    const terms = [intent, ...action.aliases];
    if (terms.some((term) => normalizeText(term) === normalizedVerb)) {
      return { intent: action.mapsTo ?? intent };
    }
  }
  return undefined;
}

function findProfileActionInText(
  rawText: string,
  profile: Profile | undefined
): { intent: string; acceptsFacts: boolean; requiresTarget?: string } | undefined {
  if (!profile) return undefined;
  const normalizedText = normalizeText(rawText);
  for (const [intent, action] of Object.entries(profile.actions)) {
    const terms = [intent, ...action.aliases];
    if (terms.some((term) => normalizedText.includes(normalizeText(term)))) {
      return {
        intent: action.mapsTo ?? intent,
        acceptsFacts: action.acceptsFacts,
        requiresTarget: action.requiresTarget
      };
    }
  }
  return undefined;
}

function pickTargetId(
  requiresTarget: string | undefined,
  mentions: {
    character?: Mention<{ id: string; name?: string; aliases?: string[] }>;
    item?: Mention<{ id: string; name?: string; aliases?: string[] }>;
    fact?: Mention<{ id: string; name?: string; aliases?: string[] }>;
    location?: Mention<{ id: string; name?: string; aliases?: string[] }>;
  }
): string | undefined {
  if (requiresTarget === "character") return mentions.character?.entity.id;
  if (requiresTarget === "item") return mentions.item?.entity.id;
  if (requiresTarget === "fact") return mentions.fact?.entity.id;
  if (requiresTarget === "location") return mentions.location?.entity.id;
  return mentions.character?.entity.id ?? mentions.item?.entity.id ?? mentions.location?.entity.id ?? mentions.fact?.entity.id;
}

function hasAny(rawText: string, terms: string[]): boolean {
  return terms.some((term) => rawText.includes(term));
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "");
}
