import type { ModelProvider } from "@aigame/agents";
import { createInitialSessionState } from "@aigame/shared";
import type { SessionState, WorldPack } from "@aigame/shared";
import { runTurn } from "./orchestrator";
import type { TurnResult } from "./orchestrator";

export interface SimulationAssertions {
  expectedKnownClues?: string[];
  expectedFlags?: Record<string, boolean>;
  forbiddenOutputPhrases?: string[];
}

export interface SimulationResult {
  finalState: SessionState;
  finalEndingId?: string;
  turns: TurnResult[];
  assertionFailures: string[];
}

export async function runSimulation(input: {
  pack: WorldPack;
  steps: string[];
  model?: ModelProvider;
  assertions?: SimulationAssertions;
}): Promise<SimulationResult> {
  let state: SessionState = createInitialSessionState(input.pack);
  const turns: TurnResult[] = [];

  for (const step of input.steps) {
    const result = await runTurn({ pack: input.pack, state, inputText: step, model: input.model });
    turns.push(result);
    state = result.state;
  }

  return {
    finalState: state,
    finalEndingId: turns.at(-1)?.endingId,
    turns,
    assertionFailures: collectAssertionFailures(state, turns, input.assertions)
  };
}

function collectAssertionFailures(
  state: SessionState,
  turns: TurnResult[],
  assertions: SimulationAssertions = {}
): string[] {
  const failures: string[] = [];

  for (const clueId of assertions.expectedKnownClues ?? []) {
    if (!state.knownClues.includes(clueId)) {
      failures.push(`Expected known clue: ${clueId}`);
    }
  }

  for (const [flag, expectedValue] of Object.entries(assertions.expectedFlags ?? {})) {
    const actualValue = state.flags[flag];
    if (actualValue !== expectedValue && !(expectedValue === false && actualValue === undefined)) {
      failures.push(`Expected flag ${flag}=${expectedValue} but got ${formatFlagValue(actualValue)}`);
    }
  }

  const outputText = turns.map((turn) => turn.outputText).join("\n");
  for (const phrase of assertions.forbiddenOutputPhrases ?? []) {
    if (phrase.length > 0 && outputText.includes(phrase)) {
      failures.push(`Forbidden output phrase leaked: ${phrase}`);
    }
  }

  return failures;
}

function formatFlagValue(value: boolean | undefined): string {
  return value === undefined ? "undefined" : String(value);
}
