import { auditOutput, buildCharacterContext, buildNarratorContext, buildSystemPrompt, FakeModelProvider } from "@aigame/agents";
import type { ModelProvider } from "@aigame/agents";
import { PatchSchema } from "@aigame/shared";
import type { GameAction, GamePatch, SessionState, TimelineEvent, TurnMessage, WorldPack } from "@aigame/shared";
import { applyAcceptedPatch, deriveTriggerPatches, evaluateCondition, judgeEnding, validatePatch } from "@aigame/rules";
import { parseAction } from "./actionParser";
import { buildActionLexicon, resolveActionSegmentsWithModel } from "./actionResolver";
import { buildTimelineEvents } from "./timeline";

export interface TurnResult {
  action: GameAction;
  outputText: string;
  messages: TurnMessage[];
  timelineEvents: TimelineEvent[];
  state: SessionState;
  acceptedPatches: GamePatch[];
  rejectedPatches: Array<{ patch: GamePatch; reason: string }>;
  endingId?: string;
  trace: Record<string, unknown>;
}

export async function runTurn(input: {
  pack: WorldPack;
  state: SessionState;
  inputText: string;
  model?: ModelProvider;
  modelName?: string;
  resolvedAction?: GameAction;
  actionResolverModel?: ModelProvider;
  actionResolverModelName?: string;
  signal?: AbortSignal;
}): Promise<TurnResult> {
  const model = input.model ?? new FakeModelProvider();
  const modelName = input.modelName ?? "fake";
  const actionResolverModelName = input.actionResolverModelName ?? "fake-action-resolver";
  const timestamp = new Date().toISOString();
  const action = resolveStatefulAction(await resolveTurnAction(input, actionResolverModelName), input.pack, input.state);
  const precheck = precheckAction(action, input.pack, input.state);
  if (!precheck.ok) {
    const messages: TurnMessage[] = [{ type: "system", text: formatBlockedAction(precheck.reason) }];
    return {
      action,
      outputText: messagesToText(input.pack, messages),
      messages,
      timelineEvents: buildTimelineEvents({ command: input.inputText, timestamp, messages, patches: [], pack: input.pack }),
      state: { ...input.state, turn: input.state.turn + 1 },
      acceptedPatches: [],
      rejectedPatches: [],
      trace: {
        action,
        contextIds: [`location:${input.state.currentLocationId}`],
        agentRole: "none",
        actionResolverModelName: input.actionResolverModel ? actionResolverModelName : undefined,
        precheck
      }
    };
  }

  const agentRequest = buildAgentRequest(input.pack, input.state, input.inputText, action);
  const rawResponse = await model.generateStructured<unknown>({
    model: modelName,
    system: agentRequest.system,
    messages: [{ role: "user", content: JSON.stringify({ action, context: agentRequest.context }) }],
    schema: agentResponseSchema(),
    signal: input.signal
  });
  const response = normalizeAgentResponse(rawResponse);

  const acceptedPatches: GamePatch[] = [];
  const rejectedPatches: Array<{ patch: GamePatch; reason: string }> = [];
  let nextState: SessionState = { ...input.state, turn: input.state.turn + 1 };
  const rulePatches = deriveRulePatches(action, input.pack, input.state);

  for (const patch of [...rulePatches, ...response.proposedPatches]) {
    const validation = validatePatch(patch, input.pack, nextState);
    if (validation.ok) {
      acceptedPatches.push(patch);
      nextState = applyAcceptedPatch(patch, nextState);
    } else {
      rejectedPatches.push({ patch, reason: validation.reason });
    }
  }
  nextState = updateConversationFocus(action, input.pack, nextState);

  const ending = judgeEnding(input.pack, nextState);
  const messages = buildTurnMessages(input.pack, action, response, acceptedPatches, ending?.text);
  const outputText = messagesToText(input.pack, messages);
  const audit = auditOutput(outputText, { forbiddenPhrases: collectForbiddenPhrases(input.pack), requireInWorld: true });
  if (!audit.ok) {
    const auditedMessages = [{ type: "system" as const, text: "这一刻的反馈不够清晰，请换一种行动说法。" }];
    return {
      action,
      outputText: messagesToText(input.pack, auditedMessages),
      messages: auditedMessages,
      timelineEvents: buildTimelineEvents({ command: input.inputText, timestamp, messages: auditedMessages, patches: [], pack: input.pack }),
      state: { ...input.state, turn: input.state.turn + 1 },
      acceptedPatches: [],
      rejectedPatches: [
        ...rejectedPatches,
        ...acceptedPatches.map((patch) => ({ patch, reason: `Rolled back after audit failure: ${audit.reason}` }))
      ],
      trace: {
        action,
        contextIds: agentRequest.contextIds,
        agentRole: agentRequest.agentRole,
        modelName,
        actionResolverModelName: input.actionResolverModel ? actionResolverModelName : undefined,
        agentRawOutput: response,
        precheck,
        privateNotes: response.privateNotes,
        audit,
        rolledBackPatches: acceptedPatches
      }
    };
  }

  return {
    action,
    outputText: messagesToText(input.pack, messages),
    messages,
    timelineEvents: buildTimelineEvents({ command: input.inputText, timestamp, messages, patches: acceptedPatches, pack: input.pack }),
    state: nextState,
    acceptedPatches,
    rejectedPatches,
    endingId: ending?.id,
    trace: {
      action,
      contextIds: agentRequest.contextIds,
      agentRole: agentRequest.agentRole,
      modelName,
      actionResolverModelName: input.actionResolverModel ? actionResolverModelName : undefined,
      agentRawOutput: response,
      precheck,
      privateNotes: response.privateNotes,
      audit
    }
  };
}

async function resolveTurnAction(input: {
  pack: WorldPack;
  state: SessionState;
  inputText: string;
  resolvedAction?: GameAction;
  actionResolverModel?: ModelProvider;
  signal?: AbortSignal;
}, actionResolverModelName: string): Promise<GameAction> {
  if (input.resolvedAction) return input.resolvedAction;

  if (input.actionResolverModel) {
    const segments = await resolveActionSegmentsWithModel({
      pack: input.pack,
      state: input.state,
      inputText: input.inputText,
      model: input.actionResolverModel,
      modelName: actionResolverModelName,
      signal: input.signal
    });

    return segments[0]?.action ?? { type: "unknown", rawText: input.inputText };
  }

  return parseAction(input.inputText, buildActionLexicon(input.pack, input.state));
}

interface NormalizedAgentResponse {
  narration: string;
  spokenBy: Array<{ characterId: string; text: string }>;
  proposedPatches: GamePatch[];
  privateNotes: string;
}

function normalizeAgentResponse(rawResponse: unknown): NormalizedAgentResponse {
  const record = isRecord(rawResponse) ? rawResponse : {};
  const spokenBy = Array.isArray(record.spokenBy)
    ? record.spokenBy.flatMap((entry) => {
      if (!isRecord(entry) || typeof entry.text !== "string") return [];
      const characterId = typeof entry.characterId === "string"
        ? entry.characterId
        : undefined;
      return characterId ? [{ characterId, text: entry.text }] : [];
    })
    : [];

  return {
    narration: typeof record.narration === "string" ? record.narration.trim() : "",
    spokenBy,
    proposedPatches: normalizeProposedPatches(record.proposedPatches),
    privateNotes: typeof record.privateNotes === "string" ? record.privateNotes : ""
  };
}

function normalizeProposedPatches(value: unknown): GamePatch[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    const parsed = PatchSchema.safeParse(candidate);
    return parsed.success ? [parsed.data] : [];
  });
}

function resolveStatefulAction(action: GameAction, pack: WorldPack, state: SessionState): GameAction {
  if (action.type !== "unknown") return action;
  const hasTimeOrDateIntent = /时间|几点|日期|表盘|指针/.test(action.rawText);
  if (!hasTimeOrDateIntent || state.inventory.length !== 1) return action;

  const item = pack.items.find((candidate) => candidate.id === state.inventory[0]);
  return item ? { type: "inspect", targetId: item.id, rawText: action.rawText } : action;
}

function updateConversationFocus(action: GameAction, pack: WorldPack, state: SessionState): SessionState {
  if (action.type === "talk") {
    return { ...state, lastInterlocutorId: action.characterId };
  }

  if (action.type === "move") {
    const location = pack.locations.find((candidate) => candidate.id === state.currentLocationId);
    if (!location?.visibleCharacters.includes(state.lastInterlocutorId ?? "")) {
      const { lastInterlocutorId: _lastInterlocutorId, ...rest } = state;
      return rest;
    }
  }

  return state;
}

function buildTurnMessages(
  pack: WorldPack,
  action: GameAction,
  response: NormalizedAgentResponse,
  acceptedPatches: GamePatch[],
  endingText?: string
): TurnMessage[] {
  const messages: TurnMessage[] = [];
  const hasCanonicalInspectFact = action.type === "inspect" && acceptedPatches.some((patch) => patch.type === "reveal_fact");
  const narration = hasCanonicalInspectFact ? "" : response.narration;
  if (narration) {
    messages.push({
      type: action.type === "look" ? "environment" : "narration",
      text: narration
    });
  }

  for (const speech of response.spokenBy) {
    const character = pack.characters.find((candidate) => candidate.id === speech.characterId);
    if (!character) continue;
    if (action.type === "talk" && speech.characterId !== action.characterId) continue;
    messages.push({
      type: "character",
      characterId: speech.characterId,
      label: character.name,
      text: speech.text
    });
  }

  for (const patch of acceptedPatches) {
    const message = patchToMessage(pack, patch);
    if (message) messages.push(message);
  }

  if (endingText) {
    messages.push({ type: "system", text: endingText });
  }

  return messages.length > 0 ? messages : [{ type: "narration", text: "现场暂时没有新的变化。" }];
}

function patchToMessage(pack: WorldPack, patch: GamePatch): TurnMessage | undefined {
  if (patch.type === "reveal_fact") {
    const fact = pack.facts.find((candidate) => candidate.id === patch.factId);
    return {
      type: "fact",
      factId: patch.factId,
      label: fact?.name ?? patch.factId,
      text: fact?.description ?? patch.reason
    };
  }

  if (patch.type === "add_item") {
    const item = pack.items.find((candidate) => candidate.id === patch.itemId);
    return {
      type: "item",
      itemId: patch.itemId,
      label: item?.name ?? patch.itemId,
      text: item?.description ?? patch.reason
    };
  }

  return undefined;
}

function messagesToText(pack: WorldPack, messages: TurnMessage[]): string {
  const factLabel = pack.profile.labels.facts ?? "事实";
  return messages.map((message) => {
    if (message.type === "character") return `${message.label ?? message.characterId}：${message.text}`;
    if (message.type === "fact") return `${factLabel}：${message.label ?? message.factId} - ${message.text}`;
    if (message.type === "item") return `获得道具：${message.label ?? message.itemId} - ${message.text}`;
    return message.text;
  }).join("\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function precheckAction(action: GameAction, pack: WorldPack, state: SessionState): { ok: true } | { ok: false; reason: string } {
  if (action.type === "unknown") {
    return { ok: false, reason: "Unknown action" };
  }

  if (action.type === "move") {
    const validation = validatePatch({ type: "move_location", locationId: action.locationId, reason: "Rules precheck." }, pack, state);
    return validation.ok ? { ok: true } : validation;
  }

  if (action.type === "talk") {
    const current = pack.locations.find((location) => location.id === state.currentLocationId);
    const character = pack.characters.find((candidate) => candidate.id === action.characterId);
    if (!character) {
      return { ok: false, reason: `Unknown character: ${action.characterId}` };
    }
    if ((current?.visibleCharacters.length ?? 0) > 0 && !current?.visibleCharacters.includes(action.characterId)) {
      return { ok: false, reason: `Character is not visible here: ${action.characterId}` };
    }
    const topic = character.topics.find((candidate) => candidate.id === action.topic);
    if (topic && !evaluateCondition(topic.unlockCondition, state)) {
      return { ok: false, reason: `Topic unlock condition failed: ${action.characterId}.${topic.id}` };
    }
  }

  if (action.type === "group_talk") {
    const current = pack.locations.find((location) => location.id === state.currentLocationId);
    if ((current?.visibleCharacters.length ?? 0) === 0) {
      return { ok: false, reason: "No visible characters here" };
    }
  }

  if (action.type === "take") {
    const current = pack.locations.find((location) => location.id === state.currentLocationId);
    if (!pack.items.some((item) => item.id === action.itemId)) {
      return { ok: false, reason: `Unknown item: ${action.itemId}` };
    }
    if (!state.inventory.includes(action.itemId) && !current?.visibleObjects.includes(action.itemId)) {
      return { ok: false, reason: `Item is not visible here: ${action.itemId}` };
    }
    const validation = validatePatch({ type: "add_item", itemId: action.itemId, reason: "Rules precheck." }, pack, state);
    return validation.ok ? { ok: true } : validation;
  }

  return { ok: true };
}

function buildAgentRequest(pack: WorldPack, state: SessionState, inputText: string, action: GameAction) {
  if (action.type === "talk") {
    return {
      agentRole: "character",
      context: buildCharacterContext(pack, state, { characterId: action.characterId, topic: action.topic }),
      contextIds: [`location:${state.currentLocationId}`, `character:${action.characterId}`],
      system: buildSystemPrompt("character")
    };
  }

  return {
    agentRole: "narrator",
    context: buildNarratorContext(pack, state, { actionText: inputText }),
    contextIds: [`location:${state.currentLocationId}`],
    system: buildSystemPrompt("narrator")
  };
}

function agentResponseSchema() {
  return {
    type: "object",
    properties: {
      narration: { type: "string" },
      spokenBy: {
        type: "array",
        items: {
          type: "object",
          properties: {
            characterId: { type: "string" },
            text: { type: "string" }
          },
          required: ["characterId", "text"]
        }
      },
      proposedPatches: {
        type: "array",
        items: {
          type: "object"
        }
      },
      privateNotes: { type: "string" }
    },
    required: ["narration", "spokenBy", "proposedPatches", "privateNotes"]
  };
}

function collectForbiddenPhrases(pack: WorldPack): string[] {
  return pack.characters.flatMap((character) => character.forbiddenDisclosures ?? []);
}

function formatBlockedAction(reason: string): string {
  const localized = localizeRuleReason(reason);
  return reason === "Unknown action" ? localized : `行动暂时无法完成：${localized}`;
}

function localizeRuleReason(reason: string): string {
  const unreachable = reason.match(/^Location is not reachable: (.+)$/);
  if (unreachable) return `当前位置无法前往 ${unreachable[1]}。`;

  const blockedEntry = reason.match(/^Location entry condition failed: (.+)$/);
  if (blockedEntry) return `当前条件还不能进入 ${blockedEntry[1]}。`;

  const unknownLocation = reason.match(/^Unknown location: (.+)$/);
  if (unknownLocation) return `没有找到地点 ${unknownLocation[1]}。`;

  const unknownCharacter = reason.match(/^Unknown character: (.+)$/);
  if (unknownCharacter) return `没有找到角色 ${unknownCharacter[1]}。`;

  const lockedTopic = reason.match(/^Topic unlock condition failed: ([^.]+)\.(.+)$/);
  if (lockedTopic) return `当前还不能询问 ${lockedTopic[1]} 的 ${lockedTopic[2]}。`;

  const unknownFact = reason.match(/^Unknown fact: (.+)$/);
  if (unknownFact) return `没有找到事实 ${unknownFact[1]}。`;

  const unknownItem = reason.match(/^Unknown item: (.+)$/);
  if (unknownItem) return `没有找到道具 ${unknownItem[1]}。`;

  const failedFact = reason.match(/^Fact reveal condition failed: (.+)$/);
  if (failedFact) return `现在还不能确认事实 ${failedFact[1]}。`;

  const failedItem = reason.match(/^Item pickup condition failed: (.+)$/);
  if (failedItem) return `现在还不能取得道具 ${failedItem[1]}。`;

  const invisibleItem = reason.match(/^Item is not visible here: (.+)$/);
  if (invisibleItem) return `当前位置看不到道具 ${invisibleItem[1]}。`;

  const disallowedPatch = reason.match(/^Patch type not allowed: (.+)$/);
  if (disallowedPatch) return `规则不允许这类变更 ${disallowedPatch[1]}。`;

  if (reason === "Unknown action") return "这一行动没有明确落点，请换一种说法。";

  return reason;
}

function deriveRulePatches(action: GameAction, pack: WorldPack, state: SessionState): GamePatch[] {
  return [
    ...deriveInspectionPatches(action, pack, state),
    ...deriveTalkTopicPatches(action, pack, state),
    ...deriveTakeMovePatches(action, state),
    ...deriveTriggerPatches(pack, state, action)
  ];
}

function deriveInspectionPatches(action: GameAction, pack: WorldPack, state: SessionState): GamePatch[] {
  if (action.type !== "inspect") return [];

  const fact = findInspectableFact(action.targetId, pack, state);
  return fact ? [{ type: "reveal_fact", factId: fact.id, reason: `Inspected ${action.targetId}.` }] : [];
}

function deriveTakeMovePatches(action: GameAction, state: SessionState): GamePatch[] {
  if (action.type === "take" && !state.inventory.includes(action.itemId)) {
    return [{ type: "add_item", itemId: action.itemId, reason: `Took ${action.itemId}.` }];
  }

  if (action.type === "move") {
    return [{ type: "move_location", locationId: action.locationId, reason: `Moved to ${action.locationId}.` }];
  }

  return [];
}

function findInspectableFact(targetId: string, pack: WorldPack, state: SessionState) {
  const current = pack.locations.find((location) => location.id === state.currentLocationId);
  const targetIsVisible = current?.visibleObjects.includes(targetId) || state.inventory.includes(targetId);
  const directFact = pack.facts.find((candidate) => candidate.id === targetId);
  const item = pack.items.find((candidate) => candidate.id === targetId);
  const fact = directFact ?? (item?.revealsFactId ? pack.facts.find((candidate) => candidate.id === item.revealsFactId) : undefined);

  if (!fact || state.knownFacts.includes(fact.id)) return undefined;
  if (!targetIsVisible) return undefined;
  return evaluateCondition(fact.discoverableWhen, state) ? fact : undefined;
}

function deriveTalkTopicPatches(action: GameAction, pack: WorldPack, state: SessionState): GamePatch[] {
  if (action.type !== "talk") return [];

  const character = pack.characters.find((candidate) => candidate.id === action.characterId);
  const topic = character?.topics.find((candidate) => candidate.id === action.topic);
  if (!topic?.revealsFactId || state.knownFacts.includes(topic.revealsFactId)) return [];

  return [{
    type: "reveal_fact",
    factId: topic.revealsFactId,
    reason: `Topic ${action.characterId}.${topic.id} revealed ${topic.revealsFactId}.`
  }];
}
