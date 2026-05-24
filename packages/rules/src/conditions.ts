import type { Condition, SessionState } from "@aigame/shared";

export function evaluateCondition(condition: Condition | undefined, state: SessionState): boolean {
  if (!condition) {
    return true;
  }

  if ("all" in condition) {
    return condition.all.every((child) => evaluateCondition(child, state));
  }

  if ("any" in condition) {
    return condition.any.some((child) => evaluateCondition(child, state));
  }

  if ("not" in condition) {
    return !evaluateCondition(condition.not, state);
  }

  if ("location_is" in condition) {
    return state.currentLocationId === condition.location_is;
  }

  if ("flag_true" in condition) {
    return state.flags[condition.flag_true] === true;
  }

  if ("has_item" in condition) {
    return state.inventory.includes(condition.has_item);
  }

  if ("knows_clue" in condition) {
    return state.knownClues.includes(condition.knows_clue);
  }

  if ("quest_stage_is" in condition) {
    return state.questStages[condition.quest_stage_is.quest] === condition.quest_stage_is.stage;
  }

  if ("npc_attitude_at_least" in condition) {
    const actual = state.npcAttitudes[condition.npc_attitude_at_least.npc] ?? 0;
    return actual >= condition.npc_attitude_at_least.value;
  }

  return false;
}
