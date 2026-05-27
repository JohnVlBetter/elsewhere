import type { SessionState, WorldPack } from "@aigame/shared";

export function buildNarratorContext(pack: WorldPack, state: SessionState, input: { actionText: string }) {
  const location = pack.locations.find((candidate) => candidate.id === state.currentLocationId);
  const knownFacts = pack.facts.filter((fact) => state.knownFacts.includes(fact.id));
  const visibleObjects = location?.visibleObjects ?? [];
  const visibleCharacterIds = location?.visibleCharacters ?? [];
  const visibleCharacters = pack.characters
    .filter((character) => visibleCharacterIds.includes(character.id))
    .map((character) => ({
      id: character.id,
      name: character.name,
      aliases: character.aliases,
      publicDescription: character.publicDescription,
      topics: character.topics.map((topic) => ({
        id: topic.id,
        prompt: topic.prompt,
        aliases: topic.aliases
      }))
    }));
  const visibleItems = pack.items.filter((item) => visibleObjects.includes(item.id));
  const inventoryItems = pack.items.filter((item) => state.inventory.includes(item.id));

  return {
    profile: pack.profile,
    actionText: input.actionText,
    location,
    currentState: state,
    visibleCharacters,
    visibleObjects,
    visibleItems,
    visibleFacts: knownFacts,
    inventoryItems,
    knownFacts,
    resources: state.resources,
    relationships: state.relationships,
    objectiveStages: state.objectiveStages,
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
