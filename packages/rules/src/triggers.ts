import type { GameAction, GamePatch, RuleTrigger, SessionState, WorldPack } from "@aigame/shared";
import { evaluateCondition } from "./conditions";

export function deriveTriggerPatches(pack: WorldPack, state: SessionState, action: GameAction): GamePatch[] {
  return pack.rules.triggers.flatMap((trigger) => {
    if (!matchesTriggerAction(trigger, action)) return [];
    if (trigger.when && !evaluateCondition(trigger.when, state)) return [];
    if (trigger.unless && evaluateCondition(trigger.unless, state)) return [];
    return trigger.patches;
  });
}

function matchesTriggerAction(trigger: RuleTrigger, action: GameAction): boolean {
  const expected = trigger.on;
  if (expected.action !== action.type) return false;

  if (expected.intent && (!("intent" in action) || action.intent !== expected.intent)) return false;
  if (expected.targetId && (!("targetId" in action) || action.targetId !== expected.targetId)) return false;
  if (expected.characterId && (!("characterId" in action) || action.characterId !== expected.characterId)) return false;
  if (expected.itemId && (!("itemId" in action) || action.itemId !== expected.itemId)) return false;
  if (expected.locationId && (!("locationId" in action) || action.locationId !== expected.locationId)) return false;

  if (expected.factIds?.length) {
    if (!("factIds" in action)) return false;
    const actionFacts = new Set(action.factIds);
    if (!expected.factIds.every((factId) => actionFacts.has(factId))) return false;
  }

  return true;
}
