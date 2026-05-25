import { auditOutput, buildNarratorContext, buildNpcContext, FakeModelProvider } from "@aigame/agents";
import type { ModelProvider } from "@aigame/agents";
import { PatchSchema } from "@aigame/shared";
import type { GameAction, GamePatch, SessionState, TurnMessage, WorldPack } from "@aigame/shared";
import { applyAcceptedPatch, evaluateCondition, judgeEnding, validatePatch } from "@aigame/rules";
import { parseAction } from "./actionParser";

export interface TurnResult {
  outputText: string;
  messages: TurnMessage[];
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
}): Promise<TurnResult> {
  const model = input.model ?? new FakeModelProvider();
  const modelName = input.modelName ?? "fake";
  const action = resolveStatefulAction(parseAction(input.inputText, input.pack), input.pack, input.state);
  const precheck = precheckAction(action, input.pack, input.state);
  if (!precheck.ok) {
    const messages: TurnMessage[] = [{ type: "system", text: formatBlockedAction(precheck.reason) }];
    return {
      outputText: messagesToText(messages),
      messages,
      state: { ...input.state, turn: input.state.turn + 1 },
      acceptedPatches: [],
      rejectedPatches: [],
      trace: {
        action,
        contextIds: [`location:${input.state.currentLocationId}`],
        agentRole: "none",
        precheck
      }
    };
  }
  const agentRequest = buildAgentRequest(input.pack, input.state, input.inputText, action);

  const rawResponse = await model.generateStructured<unknown>({
    model: modelName,
    system: agentRequest.system,
    messages: [{ role: "user", content: JSON.stringify({ action, context: agentRequest.context }) }],
    schema: agentResponseSchema()
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

  const ending = judgeEnding(input.pack, nextState);
  const messages = buildTurnMessages(input.pack, action, response, acceptedPatches, ending?.text);
  const outputText = messagesToText(messages);
  const audit = auditOutput(outputText, { forbiddenPhrases: collectForbiddenPhrases(input.pack), requireInWorld: true });
  const auditedMessages = audit.ok
    ? messages
    : [{ type: "system" as const, text: "这一刻的反馈不够清晰，请换一种行动说法。" }];

  return {
    outputText: messagesToText(auditedMessages),
    messages: auditedMessages,
    state: nextState,
    acceptedPatches,
    rejectedPatches,
    endingId: ending?.id,
    trace: {
      action,
      contextIds: agentRequest.contextIds,
      agentRole: agentRequest.agentRole,
      modelName,
      agentRawOutput: response,
      precheck,
      privateNotes: response.privateNotes,
      audit
    }
  };
}

interface NormalizedAgentResponse {
  narration: string;
  spokenBy: Array<{ npcId: string; text: string }>;
  proposedPatches: GamePatch[];
  privateNotes: string;
}

function normalizeAgentResponse(rawResponse: unknown): NormalizedAgentResponse {
  const record = isRecord(rawResponse) ? rawResponse : {};
  const spokenBy = Array.isArray(record.spokenBy)
    ? record.spokenBy.flatMap((entry) => {
      if (isRecord(entry) && typeof entry.npcId === "string" && typeof entry.text === "string") {
        return [{ npcId: entry.npcId, text: entry.text }];
      }
      return [];
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

function buildTurnMessages(
  pack: WorldPack,
  action: GameAction,
  response: NormalizedAgentResponse,
  acceptedPatches: GamePatch[],
  endingText?: string
): TurnMessage[] {
  const messages: TurnMessage[] = [];
  const hasCanonicalInspectClue = action.type === "inspect" && acceptedPatches.some((patch) => patch.type === "discover_clue");
  const narration = hasCanonicalInspectClue ? "" : response.narration;
  if (narration) {
    messages.push({
      type: action.type === "look" ? "environment" : "narration",
      text: narration
    });
  }

  for (const speech of response.spokenBy) {
    const npc = pack.npcs.find((candidate) => candidate.id === speech.npcId);
    messages.push({
      type: "npc",
      npcId: speech.npcId,
      label: npc?.name ?? speech.npcId,
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
  if (patch.type === "discover_clue") {
    const clue = pack.clues.find((candidate) => candidate.id === patch.clueId);
    return {
      type: "clue",
      clueId: patch.clueId,
      label: clue?.name ?? patch.clueId,
      text: clue?.description ?? patch.reason
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

function messagesToText(messages: TurnMessage[]): string {
  return messages.map((message) => {
    if (message.type === "npc") return `${message.label ?? message.npcId}：${message.text}`;
    if (message.type === "clue") return `线索：${message.label ?? message.clueId} - ${message.text}`;
    if (message.type === "item") return `获得道具：${message.label ?? message.itemId} - ${message.text}`;
    return message.text;
  }).join("\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function precheckAction(action: GameAction, pack: WorldPack, state: SessionState): { ok: true } | { ok: false; reason: string } {
  if (action.type === "move") {
    const validation = validatePatch({ type: "move_location", locationId: action.locationId, reason: "Rules precheck." }, pack, state);
    return validation.ok ? { ok: true } : validation;
  }

  if (action.type === "ask" && !pack.npcs.some((npc) => npc.id === action.npcId)) {
    return { ok: false, reason: `Unknown NPC: ${action.npcId}` };
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
  const coreInstruction = [
    "你是一个受规则引擎约束的互动剧情代理，必须把 context 里的事实当作唯一权威。",
    "不要发明 NPC、地点、道具、线索、时间、ID 或状态变化；尤其是时间、日期、物品归属和已发现线索必须与 context.canonicalClues、context.canonicalItems、currentState 完全一致。",
    "如果玩家没有成功获得道具、发现线索或移动地点，不要在 narration 里声称已经成功；状态变化只能通过 proposedPatches 表达。",
    "narration 只写环境、动作结果和可感知反应，不写 NPC 台词。NPC 的原话必须放在 spokenBy 里。"
  ].join("\n");
  const responseInstruction =
    "只返回一个有效 JSON 对象，不要用 Markdown 包裹。字段必须是：narration (string)、spokenBy (array of { npcId, text })、proposedPatches (array)、privateNotes (string)。proposedPatches 只能使用 discover_clue/add_item/remove_item/move_location/set_flag/adjust_npc_attitude/set_quest_stage 的精确字段名和已有 ID；严禁使用 JSON Patch 风格的 op/path/value。";
  const languageInstruction = pack.prompts.language?.trim() || "默认使用简体中文回应玩家。";

  if (action.type === "ask") {
    return {
      agentRole: "npc",
      context: buildNpcContext(pack, state, { npcId: action.npcId, topic: action.topic }),
      contextIds: [`location:${state.currentLocationId}`, `npc:${action.npcId}`],
      system: [
        languageInstruction,
        coreInstruction,
        pack.prompts.npc?.trim() || "NPC 角色代理：只能以当前指定 NPC 的身份回应，不要直接修改状态。",
        "本轮是 NPC 回应：spokenBy 必须只包含当前 NPC 的台词；不要让旁白代替 NPC 回答。",
        responseInstruction
      ].join("\n\n")
    };
  }

  return {
    agentRole: "narrator",
    context: buildNarratorContext(pack, state, { actionText: inputText }),
    contextIds: [`location:${state.currentLocationId}`],
    system: [
      languageInstruction,
      coreInstruction,
      pack.prompts.narrator?.trim() || "旁白代理：描述当前行动在世界内造成的直接结果，不要直接修改状态。",
      "本轮是旁白/环境处理：如果确实需要角色说话，必须放入 spokenBy；否则 spokenBy 返回空数组。",
      responseInstruction
    ].join("\n\n")
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
            npcId: { type: "string" },
            text: { type: "string" }
          },
          required: ["npcId", "text"]
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
  return pack.npcs.flatMap((npc) => npc.forbiddenDisclosures);
}

function formatBlockedAction(reason: string): string {
  return `行动暂时无法完成：${localizeRuleReason(reason)}`;
}

function localizeRuleReason(reason: string): string {
  const unreachable = reason.match(/^Location is not reachable: (.+)$/);
  if (unreachable) return `当前位置无法前往 ${unreachable[1]}。`;

  const unknownNpc = reason.match(/^Unknown NPC: (.+)$/);
  if (unknownNpc) return `没有找到角色 ${unknownNpc[1]}。`;

  const unknownClue = reason.match(/^Unknown clue: (.+)$/);
  if (unknownClue) return `没有找到线索 ${unknownClue[1]}。`;

  const unknownItem = reason.match(/^Unknown item: (.+)$/);
  if (unknownItem) return `没有找到道具 ${unknownItem[1]}。`;

  const failedClue = reason.match(/^Clue discovery condition failed: (.+)$/);
  if (failedClue) return `现在还不能发现线索 ${failedClue[1]}。`;

  const failedItem = reason.match(/^Item pickup condition failed: (.+)$/);
  if (failedItem) return `现在还不能取得道具 ${failedItem[1]}。`;

  const invisibleItem = reason.match(/^Item is not visible here: (.+)$/);
  if (invisibleItem) return `当前位置看不到道具 ${invisibleItem[1]}。`;

  const disallowedPatch = reason.match(/^Patch type not allowed: (.+)$/);
  if (disallowedPatch) return `规则不允许这类变更 ${disallowedPatch[1]}。`;

  return reason;
}

function deriveRulePatches(action: GameAction, pack: WorldPack, state: SessionState): GamePatch[] {
  if (action.type === "inspect") {
    const clue = findInspectableClue(action.targetId, pack, state);
    if (clue) {
      return [{ type: "discover_clue", clueId: clue.id, reason: `Inspected ${action.targetId}.` }];
    }
  }

  if (action.type === "ask") {
    const topic = findNpcTopic(action.npcId, action.topic, pack);
    const clue = topic?.revealsClueId ? pack.clues.find((candidate) => candidate.id === topic.revealsClueId) : undefined;
    if (clue && !state.knownClues.includes(clue.id) && evaluateCondition(clue.discoverableWhen, state)) {
      return [{ type: "discover_clue", clueId: clue.id, reason: `Asked ${action.npcId} about ${action.topic}.` }];
    }
  }

  if (action.type === "take") {
    if (!state.inventory.includes(action.itemId)) {
      return [{ type: "add_item", itemId: action.itemId, reason: `Took ${action.itemId}.` }];
    }
  }

  if (action.type === "move") {
    return [{ type: "move_location", locationId: action.locationId, reason: `Moved to ${action.locationId}.` }];
  }

  if (action.type === "accuse") {
    const evidence = new Set([...state.knownClues, ...action.clueIds]);
    const hasTrueEvidence =
      action.npcId === "butler" &&
      evidence.has("broken_watch") &&
      evidence.has("muddy_bootprint") &&
      evidence.has("tower_bell_record");

    return hasTrueEvidence
      ? [{ type: "set_flag", flag: "accused_butler", value: true, reason: "Player accused the butler with required evidence." }]
      : [{ type: "set_flag", flag: "wrong_accusation", value: true, reason: "Player accused without the required evidence." }];
  }

  return [];
}

function findInspectableClue(targetId: string, pack: WorldPack, state: SessionState) {
  const current = pack.locations.find((location) => location.id === state.currentLocationId);
  const targetIsVisible = current?.visibleObjects.includes(targetId) || state.inventory.includes(targetId);
  const directClue = pack.clues.find((candidate) => candidate.id === targetId);
  const item = pack.items.find((candidate) => candidate.id === targetId);
  const clue = directClue ?? (item?.revealsClueId ? pack.clues.find((candidate) => candidate.id === item.revealsClueId) : undefined);

  if (!clue || state.knownClues.includes(clue.id)) return undefined;
  if (!directClue && !targetIsVisible) return undefined;
  return evaluateCondition(clue.discoverableWhen, state) ? clue : undefined;
}

function findNpcTopic(npcId: string, topicId: string, pack: WorldPack) {
  const npc = pack.npcs.find((candidate) => candidate.id === npcId);
  return npc?.topics.find((topic) => topic.id === topicId);
}
