import type { GamePatch, SessionState, WorldPack } from "@aigame/shared";
import { evaluateCondition } from "./conditions";

export type PatchValidation = { ok: true } | { ok: false; reason: string };

export function validatePatch(patch: GamePatch, pack: WorldPack, state: SessionState): PatchValidation {
  if (!pack.rules.allowedPatchTypes.includes(patch.type)) {
    return { ok: false, reason: `Patch type not allowed: ${patch.type}` };
  }

  if (patch.type === "discover_clue") {
    const clue = pack.clues.find((candidate) => candidate.id === patch.clueId);
    if (!clue) {
      return { ok: false, reason: `Unknown clue: ${patch.clueId}` };
    }
    if (!evaluateCondition(clue.discoverableWhen, state)) {
      return { ok: false, reason: `Clue discovery condition failed: ${patch.clueId}` };
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

  if (patch.type === "move_location") {
    const current = pack.locations.find((location) => location.id === state.currentLocationId);
    if (!current?.exits.includes(patch.locationId)) {
      return { ok: false, reason: `Location is not reachable: ${patch.locationId}` };
    }
  }

  return { ok: true };
}

export function applyAcceptedPatch(patch: GamePatch, state: SessionState): SessionState {
  const next: SessionState = {
    ...state,
    inventory: [...state.inventory],
    knownClues: [...state.knownClues],
    flags: { ...state.flags },
    npcAttitudes: { ...state.npcAttitudes },
    questStages: { ...state.questStages }
  };

  if (patch.type === "discover_clue" && !next.knownClues.includes(patch.clueId)) {
    next.knownClues.push(patch.clueId);
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

  if (patch.type === "adjust_npc_attitude") {
    next.npcAttitudes[patch.npcId] = (next.npcAttitudes[patch.npcId] ?? 0) + patch.delta;
  }

  if (patch.type === "set_quest_stage") {
    next.questStages[patch.questId] = patch.stage;
  }

  return next;
}
