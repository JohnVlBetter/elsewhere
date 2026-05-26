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

  if ("knows_fact" in condition) {
    return state.knownFacts.includes(condition.knows_fact);
  }

  if ("objective_stage_is" in condition) {
    return state.objectiveStages[condition.objective_stage_is.objective] === condition.objective_stage_is.stage;
  }

  if ("relationship_at_least" in condition) {
    const actual = state.relationships[condition.relationship_at_least.character] ?? 0;
    return actual >= condition.relationship_at_least.value;
  }

  if ("relationship_at_most" in condition) {
    const actual = state.relationships[condition.relationship_at_most.character] ?? 0;
    return actual <= condition.relationship_at_most.value;
  }

  if ("resource_at_least" in condition) {
    const actual = state.resources[condition.resource_at_least.resource] ?? 0;
    return actual >= condition.resource_at_least.value;
  }

  if ("resource_at_most" in condition) {
    const actual = state.resources[condition.resource_at_most.resource] ?? 0;
    return actual <= condition.resource_at_most.value;
  }

  return false;
}
