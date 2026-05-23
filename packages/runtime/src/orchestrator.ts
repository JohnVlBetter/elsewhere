import { auditOutput, buildNarratorContext, FakeModelProvider, ModelProvider } from "@aigame/agents";
import { GameAction, GamePatch, SessionState, WorldPack } from "@aigame/shared";
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
}): Promise<TurnResult> {
  const model = input.model ?? new FakeModelProvider();
  const action = parseAction(input.inputText);
  const context = buildNarratorContext(input.pack, input.state, { actionText: input.inputText });

  const response = await model.generateStructured<{
    narration: string;
    spokenBy: Array<{ npcId: string; text: string }>;
    proposedPatches: GamePatch[];
    privateNotes: string;
  }>({
    model: "fake",
    system: "Return narration and proposed patches. Do not mutate state directly.",
    messages: [{ role: "user", content: JSON.stringify({ action, context }) }],
    schema: { type: "object" }
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
      contextIds: [`location:${input.state.currentLocationId}`],
      privateNotes: response.privateNotes,
      audit
    }
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
