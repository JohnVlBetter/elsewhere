import type { GamePatch, WorldPack } from "@aigame/shared";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateWorldPack(pack: WorldPack): ValidationResult {
  const errors: string[] = [];
  const locationIds = new Set(pack.locations.map((location) => location.id));
  const characterIds = new Set(pack.characters.map((character) => character.id));
  const factIds = new Set(pack.facts.map((fact) => fact.id));
  const itemIds = new Set(pack.items.map((item) => item.id));
  const resourceIds = new Set(pack.resources.map((resource) => resource.id));
  const profileActionIds = new Set(Object.keys(pack.profile.actions));
  const references = { locationIds, characterIds, factIds, itemIds, resourceIds, objectives: pack.objectives };

  collectDuplicateIds("location", pack.locations.map((location) => location.id), errors);
  collectDuplicateIds("character", pack.characters.map((character) => character.id), errors);
  collectDuplicateIds("fact", pack.facts.map((fact) => fact.id), errors);
  collectDuplicateIds("item", pack.items.map((item) => item.id), errors);
  collectDuplicateIds("resource", pack.resources.map((resource) => resource.id), errors);
  collectDuplicateIds("relationship", pack.relationships.map((relationship) => relationship.characterId), errors);
  collectDuplicateIds("objective", pack.objectives.map((objective) => objective.id), errors);
  collectDuplicateIds("ending", pack.endings.map((ending) => ending.id), errors);
  collectDuplicateIds("trigger", pack.rules.triggers.map((trigger) => trigger.id), errors);

  if (pack.manifest.profileId !== pack.profile.id) {
    errors.push(`Manifest profileId ${pack.manifest.profileId} does not match profile id ${pack.profile.id}`);
  }

  if (!locationIds.has(pack.manifest.entryLocationId)) {
    errors.push(`Entry location not found: ${pack.manifest.entryLocationId}`);
  }

  for (const location of pack.locations) {
    validateConditionReferences(`Location ${location.id} entryCondition`, location.entryCondition, references, errors);
    for (const exitId of location.exits) {
      if (!locationIds.has(exitId)) {
        errors.push(`Location ${location.id} exits to missing location: ${exitId}`);
      }
    }
    for (const visibleObjectId of location.visibleObjects) {
      if (!factIds.has(visibleObjectId) && !itemIds.has(visibleObjectId)) {
        errors.push(`Location ${location.id} references missing visible object: ${visibleObjectId}`);
      }
    }
    for (const visibleCharacterId of location.visibleCharacters ?? []) {
      if (!characterIds.has(visibleCharacterId)) {
        errors.push(`Location ${location.id} references missing visible character: ${visibleCharacterId}`);
      }
    }
  }

  for (const quickAction of pack.profile.quickActions) {
    validateConditionReferences(`Profile quick action ${quickAction.label} visibleWhen`, quickAction.visibleWhen, references, errors);
  }

  for (const character of pack.characters) {
    for (const topic of character.topics) {
      validateConditionReferences(`Character ${character.id} topic ${topic.id} unlockCondition`, topic.unlockCondition, references, errors);
      if (topic.revealsFactId && !factIds.has(topic.revealsFactId)) {
        errors.push(`Character ${character.id} topic ${topic.id} reveals missing fact: ${topic.revealsFactId}`);
      }
    }
  }

  for (const fact of pack.facts) {
    validateConditionReferences(`Fact ${fact.id} discoverableWhen`, fact.discoverableWhen, references, errors);
  }

  for (const item of pack.items) {
    validateConditionReferences(`Item ${item.id} pickupCondition`, item.pickupCondition, references, errors);
    if (item.revealsFactId && !factIds.has(item.revealsFactId)) {
      errors.push(`Item ${item.id} reveals missing fact: ${item.revealsFactId}`);
    }
  }

  for (const resource of pack.resources) {
    if (resource.min > resource.max) {
      errors.push(`Resource ${resource.id} min exceeds max`);
    }
    if (resource.initial < resource.min || resource.initial > resource.max) {
      errors.push(`Resource ${resource.id} initial is out of bounds`);
    }
  }

  for (const relationship of pack.relationships) {
    if (!characterIds.has(relationship.characterId)) {
      errors.push(`Relationship references missing character: ${relationship.characterId}`);
    }
    if (relationship.min > relationship.max) {
      errors.push(`Relationship ${relationship.characterId} min exceeds max`);
    }
    if (relationship.initial < relationship.min || relationship.initial > relationship.max) {
      errors.push(`Relationship ${relationship.characterId} initial is out of bounds`);
    }
  }

  for (const objective of pack.objectives) {
    if (!objective.stages.includes(objective.initialStage)) {
      errors.push(`Objective ${objective.id} initial stage is not in stages: ${objective.initialStage}`);
    }
  }

  for (const ending of pack.endings) {
    validateConditionReferences(`Ending ${ending.id} condition`, ending.condition, references, errors);
  }

  for (const trigger of pack.rules.triggers) {
    if (trigger.on.action === "act" && trigger.on.intent && !profileActionIds.has(trigger.on.intent)) {
      errors.push(`Trigger ${trigger.id} references missing profile action: ${trigger.on.intent}`);
    }
    validateTriggerActionReferences(trigger.id, trigger.on, references, errors);
    validateConditionReferences(`Trigger ${trigger.id} when`, trigger.when, references, errors);
    validateConditionReferences(`Trigger ${trigger.id} unless`, trigger.unless, references, errors);
    for (const patch of trigger.patches) {
      if (!pack.rules.allowedPatchTypes.includes(patch.type)) {
        errors.push(`Trigger ${trigger.id} patch type is not allowed: ${patch.type}`);
      }
      validatePatchReferences(`Trigger ${trigger.id} patch ${patch.type}`, patch, references, errors);
    }
  }

  return { ok: errors.length === 0, errors };
}

interface ReferenceSets {
  locationIds: Set<string>;
  characterIds: Set<string>;
  factIds: Set<string>;
  itemIds: Set<string>;
  resourceIds: Set<string>;
  objectives: WorldPack["objectives"];
}

function validateConditionReferences(
  context: string,
  condition: unknown,
  references: ReferenceSets,
  errors: string[]
): void {
  const conditionReferences = collectConditionReferences(condition);

  conditionReferences.locationIds.forEach((locationId) => {
    if (!references.locationIds.has(locationId)) {
      errors.push(`${context} references missing location: ${locationId}`);
    }
  });

  conditionReferences.itemIds.forEach((itemId) => {
    if (!references.itemIds.has(itemId)) {
      errors.push(`${context} references missing item: ${itemId}`);
    }
  });

  conditionReferences.factIds.forEach((factId) => {
    if (!references.factIds.has(factId)) {
      errors.push(`${context} references missing fact: ${factId}`);
    }
  });

  conditionReferences.characterIds.forEach((characterId) => {
    if (!references.characterIds.has(characterId)) {
      errors.push(`${context} references missing character: ${characterId}`);
    }
  });

  conditionReferences.resourceIds.forEach((resourceId) => {
    if (!references.resourceIds.has(resourceId)) {
      errors.push(`${context} references missing resource: ${resourceId}`);
    }
  });

  conditionReferences.objectiveStages.forEach(({ objectiveId, stage }) => {
    validateObjectiveStageReference(context, objectiveId, stage, references, errors);
  });
}

function collectConditionReferences(condition: unknown): {
  locationIds: Set<string>;
  itemIds: Set<string>;
  factIds: Set<string>;
  characterIds: Set<string>;
  resourceIds: Set<string>;
  objectiveStages: Array<{ objectiveId: string; stage: string }>;
} {
  const locationIds = new Set<string>();
  const itemIds = new Set<string>();
  const factIds = new Set<string>();
  const characterIds = new Set<string>();
  const resourceIds = new Set<string>();
  const objectiveStages: Array<{ objectiveId: string; stage: string }> = [];

  function visit(node: unknown): void {
    if (!node || typeof node !== "object") return;

    if ("location_is" in node) addString(locationIds, (node as { location_is?: string }).location_is);
    if ("has_item" in node) addString(itemIds, (node as { has_item?: string }).has_item);
    if ("knows_fact" in node) addString(factIds, (node as { knows_fact?: string }).knows_fact);
    if ("factKnown" in node) addString(factIds, (node as { factKnown?: string }).factKnown);

    if ("relationship_at_least" in node) {
      addString(characterIds, (node as { relationship_at_least?: { character?: string } }).relationship_at_least?.character);
    }
    if ("relationship_at_most" in node) {
      addString(characterIds, (node as { relationship_at_most?: { character?: string } }).relationship_at_most?.character);
    }
    if ("resource_at_least" in node) {
      addString(resourceIds, (node as { resource_at_least?: { resource?: string } }).resource_at_least?.resource);
    }
    if ("resource_at_most" in node) {
      addString(resourceIds, (node as { resource_at_most?: { resource?: string } }).resource_at_most?.resource);
    }
    if ("objective_stage_is" in node) {
      const value = (node as { objective_stage_is?: { objective?: string; stage?: string } }).objective_stage_is;
      if (value?.objective && value.stage) {
        objectiveStages.push({ objectiveId: value.objective, stage: value.stage });
      }
    }

    if ("all" in node) {
      for (const child of (node as { all: unknown[] }).all) visit(child);
    }
    if ("any" in node) {
      for (const child of (node as { any: unknown[] }).any) visit(child);
    }
    if ("not" in node) {
      visit((node as { not: unknown }).not);
    }
  }

  visit(condition);
  return { locationIds, itemIds, factIds, characterIds, resourceIds, objectiveStages };
}

function validateTriggerActionReferences(
  triggerId: string,
  on: WorldPack["rules"]["triggers"][number]["on"],
  references: ReferenceSets,
  errors: string[]
): void {
  validateTriggerActionShape(triggerId, on, errors);

  if (on.targetId && !references.characterIds.has(on.targetId) && !references.itemIds.has(on.targetId) && !references.locationIds.has(on.targetId) && !references.factIds.has(on.targetId)) {
    errors.push(`Trigger ${triggerId} references missing target: ${on.targetId}`);
  }
  if (on.characterId && !references.characterIds.has(on.characterId)) {
    errors.push(`Trigger ${triggerId} references missing character: ${on.characterId}`);
  }
  if (on.itemId && !references.itemIds.has(on.itemId)) {
    errors.push(`Trigger ${triggerId} references missing item: ${on.itemId}`);
  }
  if (on.locationId && !references.locationIds.has(on.locationId)) {
    errors.push(`Trigger ${triggerId} references missing location: ${on.locationId}`);
  }
  for (const factId of on.factIds ?? []) {
    if (!references.factIds.has(factId)) {
      errors.push(`Trigger ${triggerId} references missing fact: ${factId}`);
    }
  }
}

function validateTriggerActionShape(
  triggerId: string,
  on: WorldPack["rules"]["triggers"][number]["on"],
  errors: string[]
): void {
  const allowedFieldsByAction: Record<string, Set<string>> = {
    look: new Set(),
    move: new Set(["locationId"]),
    inspect: new Set(["targetId"]),
    talk: new Set(["characterId"]),
    take: new Set(["itemId"]),
    use: new Set(["itemId", "targetId"]),
    act: new Set(["intent", "targetId", "itemId", "locationId", "factIds"]),
    unknown: new Set()
  };
  const allowedFields = allowedFieldsByAction[on.action] ?? new Set<string>();
  const presentFields = [
    "intent",
    "targetId",
    "characterId",
    "itemId",
    "locationId",
    "factIds"
  ].filter((field) => {
    const value = on[field as keyof typeof on];
    return Array.isArray(value) ? value.length > 0 : value !== undefined;
  });

  for (const field of presentFields) {
    if (!allowedFields.has(field)) {
      errors.push(`Trigger ${triggerId} field ${field} is not valid for action ${on.action}`);
    }
  }
}

function validatePatchReferences(context: string, patch: GamePatch, references: ReferenceSets, errors: string[]): void {
  if (patch.type === "reveal_fact" && !references.factIds.has(patch.factId)) {
    errors.push(`${context} references missing fact: ${patch.factId}`);
  }
  if ((patch.type === "add_item" || patch.type === "remove_item") && !references.itemIds.has(patch.itemId)) {
    errors.push(`${context} references missing item: ${patch.itemId}`);
  }
  if (patch.type === "move_location" && !references.locationIds.has(patch.locationId)) {
    errors.push(`${context} references missing location: ${patch.locationId}`);
  }
  if (patch.type === "adjust_relationship" && !references.characterIds.has(patch.characterId)) {
    errors.push(`${context} references missing character: ${patch.characterId}`);
  }
  if ((patch.type === "set_resource" || patch.type === "adjust_resource") && !references.resourceIds.has(patch.resourceId)) {
    errors.push(`${context} references missing resource: ${patch.resourceId}`);
  }
  if (patch.type === "set_objective_stage") {
    validateObjectiveStageReference(context, patch.objectiveId, patch.stage, references, errors);
  }
}

function validateObjectiveStageReference(
  context: string,
  objectiveId: string,
  stage: string,
  references: ReferenceSets,
  errors: string[]
): void {
  const objective = references.objectives.find((candidate) => candidate.id === objectiveId);
  if (!objective) {
    errors.push(`${context} references missing objective: ${objectiveId}`);
  } else if (!objective.stages.includes(stage)) {
    errors.push(`${context} references missing objective stage: ${objectiveId}.${stage}`);
  }
}

function addString(target: Set<string>, value: string | undefined): void {
  if (value) target.add(value);
}

function collectDuplicateIds(label: string, ids: string[], errors: string[]): void {
  const seen = new Set<string>();
  const reported = new Set<string>();
  for (const id of ids) {
    if (seen.has(id) && !reported.has(id)) {
      errors.push(`Duplicate ${label} id: ${id}`);
      reported.add(id);
    }
    seen.add(id);
  }
}
