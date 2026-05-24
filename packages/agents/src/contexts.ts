import type { SessionState, WorldPack } from "@aigame/shared";

export function buildNarratorContext(pack: WorldPack, state: SessionState, input: { actionText: string }) {
  const location = pack.locations.find((candidate) => candidate.id === state.currentLocationId);
  const knownClues = pack.clues.filter((clue) => state.knownClues.includes(clue.id));

  return {
    actionText: input.actionText,
    location,
    knownClues,
    turn: state.turn,
    worldTone: pack.worldText
  };
}

export function buildNpcContext(pack: WorldPack, state: SessionState, input: { npcId: string; topic: string }) {
  const npc = pack.npcs.find((candidate) => candidate.id === input.npcId);
  if (!npc) {
    throw new Error(`Unknown NPC: ${input.npcId}`);
  }

  return {
    npc,
    topic: input.topic,
    currentLocationId: state.currentLocationId,
    allowedKnownClues: state.knownClues,
    attitude: state.npcAttitudes[input.npcId] ?? 0
  };
}
