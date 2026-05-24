import { auditOutput, buildNarratorContext, buildNpcContext, FakeModelProvider } from "@aigame/agents";
import type { ModelProvider } from "@aigame/agents";
import type { GameAction, GamePatch, SessionState, WorldPack } from "@aigame/shared";
import { applyAcceptedPatch, evaluateCondition, judgeEnding, validatePatch } from "@aigame/rules";
import { parseAction } from "./actionParser";

export interface TurnResult {
  outputText: string;
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
  const action = parseAction(input.inputText);
  const precheck = precheckAction(action, input.pack, input.state);
  if (!precheck.ok) {
    return {
      outputText: `That action is blocked: ${precheck.reason}`,
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

  const response = await model.generateStructured<{
    narration: string;
    spokenBy: Array<{ npcId: string; text: string }>;
    proposedPatches: GamePatch[];
    privateNotes: string;
  }>({
    model: modelName,
    system: agentRequest.system,
    messages: [{ role: "user", content: JSON.stringify({ action, context: agentRequest.context }) }],
    schema: agentResponseSchema()
  });

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
  const outputText = ending ? `${response.narration}\n\n${ending.text}` : response.narration;
  const audit = auditOutput(outputText, { forbiddenPhrases: collectForbiddenPhrases(input.pack), requireInWorld: true });

  return {
    outputText: audit.ok ? outputText : "The moment feels unclear. Rephrase your action.",
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

function precheckAction(action: GameAction, pack: WorldPack, state: SessionState): { ok: true } | { ok: false; reason: string } {
  if (action.type === "move") {
    const validation = validatePatch({ type: "move_location", locationId: action.locationId, reason: "Rules precheck." }, pack, state);
    return validation.ok ? { ok: true } : validation;
  }

  if (action.type === "ask" && !pack.npcs.some((npc) => npc.id === action.npcId)) {
    return { ok: false, reason: `Unknown NPC: ${action.npcId}` };
  }

  return { ok: true };
}

function buildAgentRequest(pack: WorldPack, state: SessionState, inputText: string, action: GameAction) {
  const responseInstruction =
    "Return only a valid JSON object with keys narration (string), spokenBy (array), proposedPatches (array), and privateNotes (string). Do not wrap it in markdown.";

  if (action.type === "ask") {
    return {
      agentRole: "npc",
      context: buildNpcContext(pack, state, { npcId: action.npcId, topic: action.topic }),
      contextIds: [`location:${state.currentLocationId}`, `npc:${action.npcId}`],
      system: [
        "NPC Actor Agent: answer as the scoped NPC only. Do not mutate state directly.",
        responseInstruction
      ].join("\n\n")
    };
  }

  return {
    agentRole: "narrator",
    context: buildNarratorContext(pack, state, { actionText: inputText }),
    contextIds: [`location:${state.currentLocationId}`],
    system: [
      "Narrator Agent: describe the immediate in-world result and do not mutate state directly.",
      responseInstruction
    ].join("\n\n")
  };
}

function agentResponseSchema() {
  return {
    type: "object",
    properties: {
      narration: { type: "string" },
      spokenBy: { type: "array" },
      proposedPatches: { type: "array" },
      privateNotes: { type: "string" }
    },
    required: ["narration", "spokenBy", "proposedPatches", "privateNotes"]
  };
}

function collectForbiddenPhrases(pack: WorldPack): string[] {
  return pack.npcs.flatMap((npc) => npc.forbiddenDisclosures);
}

function deriveRulePatches(action: GameAction, pack: WorldPack, state: SessionState): GamePatch[] {
  if (action.type === "inspect") {
    const clue = pack.clues.find((candidate) => candidate.id === action.targetId);
    if (clue && !state.knownClues.includes(clue.id) && evaluateCondition(clue.discoverableWhen, state)) {
      return [{ type: "discover_clue", clueId: clue.id, reason: `Inspected ${action.targetId}.` }];
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
