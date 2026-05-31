import type { ModelProvider } from "@aigame/agents";
import { ActionSchema } from "@aigame/shared";
import type { GameAction, SessionState, WorldPack } from "@aigame/shared";
import { parseAction } from "./actionParser";
import type { ActionLexicon } from "./actionParser";
import { planActionSegments } from "./actionPlanner";

export interface ResolvedActionSegment {
  rawText: string;
  action: GameAction;
}

export async function resolveActionSegmentsWithModel(input: {
  pack: WorldPack;
  state: SessionState;
  inputText: string;
  model: ModelProvider;
  modelName: string;
  signal?: AbortSignal;
}): Promise<ResolvedActionSegment[]> {
  const payload = buildResolverPayload(input.pack, input.state, input.inputText);
  const rawResponse = await input.model.generateStructured<unknown>({
    model: input.modelName,
    system: buildActionResolverSystemPrompt(),
    messages: [{ role: "user", content: JSON.stringify(payload) }],
    schema: actionResolverSchema(),
    temperature: 0,
    maxTokens: 900,
    signal: input.signal
  });

  return normalizeResolvedSegments(rawResponse, input.pack, input.state, input.inputText);
}

export class RuleBackedActionResolverProvider implements ModelProvider {
  async generateStructured<T>(request: Parameters<ModelProvider["generateStructured"]>[0]): Promise<T> {
    const content = request.messages.at(-1)?.content ?? "{}";
    const payload = JSON.parse(content) as ReturnType<typeof buildResolverPayload>;
    const segments = planActionSegments(payload.inputText).map((rawText) => ({
      rawText,
      action: resolveRuleBackedAction(rawText, payload.lexicon, payload.state)
    }));

    return { actions: segments } as T;
  }
}

export function buildActionLexicon(pack: WorldPack, state: SessionState): ActionLexicon {
  const location = pack.locations.find((candidate) => candidate.id === state.currentLocationId);
  const visibleObjectIds = location?.visibleObjects ?? [];

  return {
    profile: pack.profile,
    locations: pack.locations,
    characters: pack.characters,
    items: pack.items,
    facts: pack.facts,
    lastInterlocutorId: state.lastInterlocutorId,
    visibleCharacterIds: location?.visibleCharacters ?? [],
    visibleObjectIds,
    aliases: buildVisibleAliases(pack, state, visibleObjectIds)
  };
}

function buildResolverPayload(pack: WorldPack, state: SessionState, inputText: string) {
  const currentLocation = pack.locations.find((location) => location.id === state.currentLocationId);
  const visibleObjectIds = new Set([...(currentLocation?.visibleObjects ?? []), ...state.inventory]);
  const visibleCharacterIds = new Set(currentLocation?.visibleCharacters ?? []);

  return {
    inputText,
    state: {
      currentLocationId: state.currentLocationId,
      inventory: state.inventory,
      knownFacts: state.knownFacts,
      lastInterlocutorId: state.lastInterlocutorId
    },
    context: {
      currentLocation: currentLocation ? summarizeLocation(currentLocation) : undefined,
      reachableLocations: pack.locations
        .filter((location) => currentLocation?.exits.includes(location.id) || location.id === state.currentLocationId)
        .map(summarizeLocation),
      visibleItems: pack.items.filter((item) => visibleObjectIds.has(item.id)).map(summarizeEntity),
      visibleFacts: pack.facts.filter((fact) => visibleObjectIds.has(fact.id) || state.knownFacts.includes(fact.id)).map(summarizeEntity),
      visibleCharacters: pack.characters.filter((character) => visibleCharacterIds.has(character.id)).map((character) => ({
        id: character.id,
        name: character.name,
        aliases: character.aliases,
        topics: character.topics.map((topic) => ({
          id: topic.id,
          prompt: topic.prompt,
          aliases: topic.aliases
        }))
      })),
      customActions: Object.entries(pack.profile.actions).map(([id, action]) => ({
        id,
        aliases: action.aliases,
        mapsTo: action.mapsTo,
        requiresTarget: action.requiresTarget,
        acceptsFacts: action.acceptsFacts
      }))
    },
    lexicon: buildActionLexicon(pack, state)
  };
}

function buildActionResolverSystemPrompt(): string {
  return [
    "你只负责把玩家输入解析为行动 JSON，不写叙事，不推进剧情。",
    "必须只返回符合 schema 的 JSON。",
    "把一个输入中的多个行动拆成 actions 数组，保持玩家原始顺序；每个 action 保留对应 rawText。",
    "只能使用用户上下文中给出的 id。不要编造 locationId、characterId、itemId、targetId、factIds。",
    "动作类型：look、move、inspect、talk、group_talk、take、use、act、unknown。",
    "玩家表达查看当前地点、查看房间内、环顾四周、看看某个当前地点时，返回 look。",
    "玩家查看可见物品或事实时，返回 inspect，并使用对应 item/fact id 作为 targetId。",
    "玩家前往、进入、走向可达地点时，返回 move，并使用 locationId。",
    "玩家对角色说话、询问、打招呼时，返回 talk，并使用 characterId；topic 用匹配 topic id，无法匹配时用简短自然语言主题。",
    "玩家询问众人、大家、在场的人时，返回 group_talk。",
    "玩家要拿走、拾取、获得可见物品时，返回 take。",
    "玩家触发故事自定义动作时，返回 act，并使用 customActions 的 mapsTo/id 作为 intent。",
    "如果无法映射到上述动作，返回 unknown。"
  ].join("\n");
}

function actionResolverSchema() {
  return {
    type: "object",
    properties: {
      actions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            rawText: { type: "string" },
            action: { type: "object" }
          },
          required: ["rawText", "action"]
        }
      }
    },
    required: ["actions"]
  };
}

function normalizeResolvedSegments(rawResponse: unknown, pack: WorldPack, state: SessionState, fallbackText: string): ResolvedActionSegment[] {
  const lexicon = buildActionLexicon(pack, state);
  const actions = isRecord(rawResponse) && Array.isArray(rawResponse.actions) ? rawResponse.actions : [];
  const segments = actions.flatMap((entry): ResolvedActionSegment[] => {
    if (!isRecord(entry)) return [];
    const modelAction = isRecord(entry.action) ? entry.action : entry;
    const rawText = typeof entry.rawText === "string" && entry.rawText.trim() ? entry.rawText.trim() : fallbackText;
    const candidate = { ...modelAction, rawText };
    const normalized = normalizeModelAction(candidate, pack, state, rawText);
    const parsed = ActionSchema.safeParse(normalized);
    if (!parsed.success) return [];
    const action = parsed.data.type === "unknown"
      ? resolveRuleBackedAction(rawText, lexicon, state)
      : parsed.data;
    return [{ rawText, action }];
  });

  return segments.length > 0 ? segments : [{ rawText: fallbackText, action: resolveRuleBackedAction(fallbackText, lexicon, state) }];
}

function normalizeModelAction(candidate: Record<string, unknown>, pack: WorldPack, state: SessionState, rawText: string): unknown {
  if (candidate.type === "inspect" && typeof candidate.targetId === "string") {
    const targetLocation = pack.locations.find((location) => location.id === candidate.targetId);
    if (targetLocation && targetLocation.id === state.currentLocationId) {
      return { type: "look", rawText };
    }
  }

  return candidate;
}

function resolveRuleBackedAction(rawText: string, lexicon: ActionLexicon, state: { currentLocationId: string }): GameAction {
  const parsed = parseAction(rawText, lexicon);
  if (parsed.type !== "unknown") return parsed;

  if (looksLikeLocationLook(rawText, lexicon, state.currentLocationId)) {
    return { type: "look", rawText };
  }

  return parsed;
}

function looksLikeLocationLook(rawText: string, lexicon: ActionLexicon, currentLocationId: string): boolean {
  if (!hasAny(rawText, ["查看", "观察", "看看", "看", "环顾", "打量"])) return false;
  const normalized = normalizeText(rawText);
  if (hasAny(rawText, ["四周", "周围", "附近", "这里", "现场", "房间", "屋内", "室内"])) return true;

  const currentLocation = lexicon.locations?.find((location) => location.id === currentLocationId);
  return [currentLocation?.id, currentLocation?.name, ...(currentLocation?.aliases ?? [])]
    .filter((value): value is string => Boolean(value))
    .some((name) => normalized.includes(normalizeText(name)));
}

function buildVisibleAliases(pack: WorldPack, state: SessionState, visibleObjectIds: string[]): Array<{ id: string; names: string[] }> {
  const visibleIds = new Set([...visibleObjectIds, ...state.inventory]);
  return [...pack.items, ...pack.facts]
    .filter((entity) => visibleIds.has(entity.id))
    .map((entity) => ({
      id: entity.id,
      names: [entity.id, entity.name, ...(entity.aliases ?? [])]
    }));
}

function summarizeLocation(location: WorldPack["locations"][number]) {
  return {
    id: location.id,
    name: location.name,
    aliases: location.aliases,
    exits: location.exits
  };
}

function summarizeEntity(entity: { id: string; name: string; aliases?: string[] }) {
  return {
    id: entity.id,
    name: entity.name,
    aliases: entity.aliases
  };
}

function hasAny(rawText: string, terms: string[]): boolean {
  return terms.some((term) => rawText.includes(term));
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
