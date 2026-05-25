import type { SessionState, WorldPack } from "@aigame/shared";

export function buildNarratorContext(pack: WorldPack, state: SessionState, input: { actionText: string }) {
  const location = pack.locations.find((candidate) => candidate.id === state.currentLocationId);
  const knownClues = pack.clues.filter((clue) => state.knownClues.includes(clue.id));
  const visibleObjects = location?.visibleObjects ?? [];
  const visibleItems = pack.items.filter((item) => visibleObjects.includes(item.id));
  const visibleClues = pack.clues.filter((clue) => visibleObjects.includes(clue.id));
  const inventoryItems = pack.items.filter((item) => state.inventory.includes(item.id));

  return {
    actionText: input.actionText,
    location,
    currentState: state,
    visibleObjects,
    visibleItems,
    visibleClues,
    inventoryItems,
    knownClues,
    canonicalItems: pack.items,
    canonicalClues: pack.clues,
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
    currentState: state,
    allowedKnownClues: state.knownClues,
    knownClueFacts: pack.clues.filter((clue) => state.knownClues.includes(clue.id)),
    inventoryItems: pack.items.filter((item) => state.inventory.includes(item.id)),
    attitude: state.npcAttitudes[input.npcId] ?? 0
  };
}
