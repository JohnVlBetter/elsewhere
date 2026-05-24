import type { ModelProvider } from "@aigame/agents";
import type { SessionState, WorldPack } from "@aigame/shared";
import { runTurn } from "./orchestrator";
import type { TurnResult } from "./orchestrator";

export async function runSimulation(input: {
  pack: WorldPack;
  steps: string[];
  model?: ModelProvider;
}): Promise<{ finalState: SessionState; finalEndingId?: string; turns: TurnResult[] }> {
  let state: SessionState = {
    currentLocationId: input.pack.manifest.entryLocationId,
    turn: 0,
    inventory: [],
    knownClues: [],
    flags: {},
    npcAttitudes: {},
    questStages: Object.fromEntries(input.pack.quests.map((quest) => [quest.id, quest.initialStage]))
  };
  const turns: TurnResult[] = [];

  for (const step of input.steps) {
    const result = await runTurn({ pack: input.pack, state, inputText: step, model: input.model });
    turns.push(result);
    state = result.state;
  }

  return { finalState: state, finalEndingId: turns.at(-1)?.endingId, turns };
}
