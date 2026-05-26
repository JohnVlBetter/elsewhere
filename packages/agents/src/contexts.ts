import type { SessionState, WorldPack } from "@aigame/shared";

export function buildNarratorContext(pack: WorldPack, state: SessionState, input: { actionText: string }) {
  const location = pack.locations.find((candidate) => candidate.id === state.currentLocationId);
  const knownFacts = pack.facts.filter((fact) => state.knownFacts.includes(fact.id));
  const visibleObjects = location?.visibleObjects ?? [];
  const visibleItems = pack.items.filter((item) => visibleObjects.includes(item.id));
  const visibleFacts = pack.facts.filter((fact) => visibleObjects.includes(fact.id));
  const inventoryItems = pack.items.filter((item) => state.inventory.includes(item.id));

  return {
    profile: pack.profile,
    actionText: input.actionText,
    location,
    currentState: state,
    visibleObjects,
    visibleItems,
    visibleFacts,
    inventoryItems,
    knownFacts,
    resources: state.resources,
    relationships: state.relationships,
    objectiveStages: state.objectiveStages,
    canonicalItems: pack.items,
    canonicalFacts: pack.facts,
    turn: state.turn,
    worldTone: pack.worldText
  };
}

export function buildCharacterContext(pack: WorldPack, state: SessionState, input: { characterId: string; topic: string }) {
  const character = pack.characters.find((candidate) => candidate.id === input.characterId);
  if (!character) {
    throw new Error(`Unknown character: ${input.characterId}`);
  }

  return {
    profile: pack.profile,
    character,
    topic: input.topic,
    currentLocationId: state.currentLocationId,
    currentState: state,
    allowedKnownFacts: state.knownFacts,
    knownFactDetails: pack.facts.filter((fact) => state.knownFacts.includes(fact.id)),
    inventoryItems: pack.items.filter((item) => state.inventory.includes(item.id)),
    relationship: state.relationships[input.characterId] ?? 0
  };
}
