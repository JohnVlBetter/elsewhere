import type { ModelProvider } from "@aigame/agents";
import type { GameAction, SessionState, WorldPack } from "@aigame/shared";
import { planActionSegments } from "./actionPlanner";
import { resolveActionSegmentsWithModel } from "./actionResolver";
import { runTurn } from "./orchestrator";
import type { TurnResult } from "./orchestrator";

export interface MultiActionTurnEvent {
  actionIndex: number;
  inputText: string;
}

export interface MultiActionTurnResult {
  actionResults: TurnResult[];
  state: SessionState;
  stoppedAt?: MultiActionTurnEvent & { reason: string };
}

export async function runMultiActionTurn(input: {
  pack: WorldPack;
  state: SessionState;
  inputText: string;
  model?: ModelProvider;
  modelName?: string;
  actionResolverModel?: ModelProvider;
  actionResolverModelName?: string;
  signal?: AbortSignal;
  onActionStart?: (event: MultiActionTurnEvent) => void | Promise<void>;
  onActionResult?: (event: MultiActionTurnEvent & { result: TurnResult }) => void | Promise<void>;
}): Promise<MultiActionTurnResult> {
  const segments = await resolveSegments(input);
  const actionResults: TurnResult[] = [];
  let state = input.state;

  for (const [actionIndex, segment] of segments.entries()) {
    const inputText = segment.rawText;
    await input.onActionStart?.({ actionIndex, inputText });
    const result = await runTurn({
      pack: input.pack,
      state,
      inputText,
      model: input.model,
      modelName: input.modelName,
      resolvedAction: segment.action,
      signal: input.signal
    });

    actionResults.push(result);
    state = result.state;
    await input.onActionResult?.({ actionIndex, inputText, result });

    if (isFailedActionResult(result)) {
      return {
        actionResults,
        state,
        stoppedAt: {
          actionIndex,
          inputText,
          reason: failureReason(result)
        }
      };
    }
  }

  return { actionResults, state };
}

async function resolveSegments(input: {
  pack: WorldPack;
  state: SessionState;
  inputText: string;
  actionResolverModel?: ModelProvider;
  actionResolverModelName?: string;
  signal?: AbortSignal;
}): Promise<Array<{ rawText: string; action?: GameAction }>> {
  if (!input.actionResolverModel) {
    return planActionSegments(input.inputText).map((rawText) => ({ rawText }));
  }

  return resolveActionSegmentsWithModel({
    pack: input.pack,
    state: input.state,
    inputText: input.inputText,
    model: input.actionResolverModel,
    modelName: input.actionResolverModelName ?? "fake-action-resolver",
    signal: input.signal
  });
}

function isFailedActionResult(result: TurnResult): boolean {
  return result.action.type === "unknown" || isFailedPrecheck(result.trace.precheck);
}

function isFailedPrecheck(value: unknown): boolean {
  return value !== null && typeof value === "object" && "ok" in value && (value as { ok?: unknown }).ok === false;
}

function failureReason(result: TurnResult): string {
  const precheck = result.trace.precheck;
  if (isRecord(precheck) && typeof precheck.reason === "string") return precheck.reason;
  return result.outputText || "Action failed";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
