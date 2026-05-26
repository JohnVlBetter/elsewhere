import type { ModelProvider } from "@aigame/agents";
import { createInitialSessionState } from "@aigame/shared";
import type { SessionState, WorldPack } from "@aigame/shared";
import { runTurn } from "./orchestrator";
import type { TurnResult } from "./orchestrator";

export interface SimulationAssertions {
  expectedKnownFacts?: string[];
  expectedFlags?: Record<string, boolean>;
  expectedResources?: Record<string, number>;
  expectedRelationships?: Record<string, number>;
  expectedObjectiveStages?: Record<string, string>;
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

  for (const factId of assertions.expectedKnownFacts ?? []) {
    if (!state.knownFacts.includes(factId)) {
      failures.push(`Expected known fact: ${factId}`);
    }
  }

  for (const [flag, expectedValue] of Object.entries(assertions.expectedFlags ?? {})) {
    const actualValue = state.flags[flag];
    if (actualValue !== expectedValue && !(expectedValue === false && actualValue === undefined)) {
      failures.push(`Expected flag ${flag}=${expectedValue} but got ${formatStateValue(actualValue)}`);
    }
  }

  for (const [resourceId, expectedValue] of Object.entries(assertions.expectedResources ?? {})) {
    const actualValue = state.resources[resourceId];
    if (actualValue !== expectedValue) {
      failures.push(`Expected resource ${resourceId}=${expectedValue} but got ${formatStateValue(actualValue)}`);
    }
  }

  for (const [characterId, expectedValue] of Object.entries(assertions.expectedRelationships ?? {})) {
    const actualValue = state.relationships[characterId];
    if (actualValue !== expectedValue) {
      failures.push(`Expected relationship ${characterId}=${expectedValue} but got ${formatStateValue(actualValue)}`);
    }
  }

  for (const [objectiveId, expectedStage] of Object.entries(assertions.expectedObjectiveStages ?? {})) {
    const actualStage = state.objectiveStages[objectiveId];
    if (actualStage !== expectedStage) {
      failures.push(`Expected objective stage ${objectiveId}=${expectedStage} but got ${formatStateValue(actualStage)}`);
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

function formatStateValue(value: string | number | boolean | undefined): string {
  return value === undefined ? "undefined" : String(value);
}
