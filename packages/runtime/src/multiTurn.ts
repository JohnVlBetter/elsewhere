import type { ModelProvider } from "@aigame/agents";
import type { SessionState, WorldPack } from "@aigame/shared";
import { planActionSegments } from "./actionPlanner";
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
  signal?: AbortSignal;
  onActionStart?: (event: MultiActionTurnEvent) => void | Promise<void>;
  onActionResult?: (event: MultiActionTurnEvent & { result: TurnResult }) => void | Promise<void>;
}): Promise<MultiActionTurnResult> {
  const segments = planActionSegments(input.inputText);
  const actionResults: TurnResult[] = [];
  let state = input.state;

  for (const [actionIndex, inputText] of segments.entries()) {
    await input.onActionStart?.({ actionIndex, inputText });
    const result = await runTurn({
      pack: input.pack,
      state,
      inputText,
      model: input.model,
      modelName: input.modelName,
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

function isFailedActionResult(result: TurnResult): boolean {
  return result.action.type === "unknown" || isFailedPrecheck(result.trace.precheck);
}

function isFailedPrecheck(value: unknown): boolean {
  return Boolean(value) && typeof value === "object" && "ok" in value && (value as { ok?: unknown }).ok === false;
}

function failureReason(result: TurnResult): string {
  const precheck = result.trace.precheck;
  if (isRecord(precheck) && typeof precheck.reason === "string") return precheck.reason;
  return result.outputText || "Action failed";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
