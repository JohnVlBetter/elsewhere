import type { GamePatch, SessionState, WorldPack } from "@aigame/shared";
import { evaluateCondition } from "./conditions";

export type PatchValidation = { ok: true } | { ok: false; reason: string };

export function validatePatch(patch: GamePatch, pack: WorldPack, state: SessionState): PatchValidation {
  if (!pack.rules.allowedPatchTypes.includes(patch.type)) {
    return { ok: false, reason: `Patch type not allowed: ${patch.type}` };
  }

  if (patch.type === "reveal_fact") {
    const fact = pack.facts.find((candidate) => candidate.id === patch.factId);
    if (!fact) {
      return { ok: false, reason: `Unknown fact: ${patch.factId}` };
    }
    if (!evaluateCondition(fact.discoverableWhen, state)) {
      return { ok: false, reason: `Fact reveal condition failed: ${patch.factId}` };
    }
  }

  if (patch.type === "add_item") {
    const item = pack.items.find((candidate) => candidate.id === patch.itemId);
    if (!item) {
      return { ok: false, reason: `Unknown item: ${patch.itemId}` };
    }
    if (!evaluateCondition(item.pickupCondition, state)) {
      return { ok: false, reason: `Item pickup condition failed: ${patch.itemId}` };
    }
  }

  if (patch.type === "remove_item" && !pack.items.some((item) => item.id === patch.itemId)) {
    return { ok: false, reason: `Unknown item: ${patch.itemId}` };
  }

  if (patch.type === "move_location") {
    const current = pack.locations.find((location) => location.id === state.currentLocationId);
    if (!current?.exits.includes(patch.locationId)) {
      return { ok: false, reason: `Location is not reachable: ${patch.locationId}` };
    }
    const destination = pack.locations.find((location) => location.id === patch.locationId);
    if (!destination) {
      return { ok: false, reason: `Unknown location: ${patch.locationId}` };
    }
    if (!evaluateCondition(destination.entryCondition, state)) {
      return { ok: false, reason: `Location entry condition failed: ${patch.locationId}` };
    }
  }

  if (patch.type === "adjust_relationship" && !pack.characters.some((character) => character.id === patch.characterId)) {
    return { ok: false, reason: `Unknown character: ${patch.characterId}` };
  }

  if (patch.type === "set_objective_stage") {
    const objective = pack.objectives.find((candidate) => candidate.id === patch.objectiveId);
    if (!objective) {
      return { ok: false, reason: `Unknown objective: ${patch.objectiveId}` };
    }
    if (!objective.stages.includes(patch.stage)) {
      return { ok: false, reason: `Unknown objective stage: ${patch.objectiveId}.${patch.stage}` };
    }
  }

  if (patch.type === "set_resource") {
    const validation = validateResourceValue(patch.resourceId, patch.value, pack);
    if (!validation.ok) return validation;
  }

  if (patch.type === "adjust_resource") {
    const currentValue = state.resources[patch.resourceId] ?? 0;
    const validation = validateResourceValue(patch.resourceId, currentValue + patch.delta, pack);
    if (!validation.ok) return validation;
  }

  return { ok: true };
}

export function applyAcceptedPatch(patch: GamePatch, state: SessionState): SessionState {
  const next: SessionState = {
    ...state,
    inventory: [...state.inventory],
    knownFacts: [...state.knownFacts],
    resources: { ...state.resources },
    relationships: { ...state.relationships },
    flags: { ...state.flags },
    objectiveStages: { ...state.objectiveStages }
  };

  if (patch.type === "reveal_fact" && !next.knownFacts.includes(patch.factId)) {
    next.knownFacts.push(patch.factId);
  }

  if (patch.type === "add_item" && !next.inventory.includes(patch.itemId)) {
    next.inventory.push(patch.itemId);
  }

  if (patch.type === "remove_item") {
    next.inventory = next.inventory.filter((itemId) => itemId !== patch.itemId);
  }

  if (patch.type === "move_location") {
    next.currentLocationId = patch.locationId;
  }

  if (patch.type === "set_flag") {
    next.flags[patch.flag] = patch.value;
  }

  if (patch.type === "adjust_relationship") {
    next.relationships[patch.characterId] = (next.relationships[patch.characterId] ?? 0) + patch.delta;
  }

  if (patch.type === "set_resource") {
    next.resources[patch.resourceId] = patch.value;
  }

  if (patch.type === "adjust_resource") {
    next.resources[patch.resourceId] = (next.resources[patch.resourceId] ?? 0) + patch.delta;
  }

  if (patch.type === "set_objective_stage") {
    next.objectiveStages[patch.objectiveId] = patch.stage;
  }

  return next;
}

function validateResourceValue(resourceId: string, value: number, pack: WorldPack): PatchValidation {
  const resource = pack.resources.find((candidate) => candidate.id === resourceId);
  if (!resource) {
    return { ok: false, reason: `Unknown resource: ${resourceId}` };
  }
  if (value < resource.min || value > resource.max) {
    return { ok: false, reason: `Resource out of bounds: ${resourceId}=${value}` };
  }
  return { ok: true };
}
