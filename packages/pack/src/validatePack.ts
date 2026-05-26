import type { WorldPack } from "@aigame/shared";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateWorldPack(pack: WorldPack): ValidationResult {
  const errors: string[] = [];
  const locationIds = new Set(pack.locations.map((location) => location.id));
  const npcIds = new Set(pack.npcs.map((npc) => npc.id));
  const clueIds = new Set(pack.clues.map((clue) => clue.id));
  const itemIds = new Set(pack.items.map((item) => item.id));
  const references = { locationIds, npcIds, clueIds, itemIds, quests: pack.quests };

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
      if (!clueIds.has(visibleObjectId) && !itemIds.has(visibleObjectId)) {
        errors.push(`Location ${location.id} references missing visible object: ${visibleObjectId}`);
      }
    }
  }

  for (const npc of pack.npcs) {
    for (const topic of npc.topics) {
      validateConditionReferences(`NPC ${npc.id} topic ${topic.id} unlockCondition`, topic.unlockCondition, references, errors);
      if (topic.revealsClueId && !clueIds.has(topic.revealsClueId)) {
        errors.push(`NPC ${npc.id} topic ${topic.id} reveals missing clue: ${topic.revealsClueId}`);
      }
    }
  }

  for (const clue of pack.clues) {
    validateConditionReferences(`Clue ${clue.id} discoverableWhen`, clue.discoverableWhen, references, errors);
  }

  for (const item of pack.items) {
    validateConditionReferences(`Item ${item.id} pickupCondition`, item.pickupCondition, references, errors);
    if (item.revealsClueId && !clueIds.has(item.revealsClueId)) {
      errors.push(`Item ${item.id} reveals missing clue: ${item.revealsClueId}`);
    }
  }

  for (const quest of pack.quests) {
    if (!quest.stages.includes(quest.initialStage)) {
      errors.push(`Quest ${quest.id} initial stage is not in stages: ${quest.initialStage}`);
    }
  }

  for (const ending of pack.endings) {
    validateConditionReferences(`Ending ${ending.id} condition`, ending.condition, references, errors);
  }

  return { ok: errors.length === 0, errors };
}

interface ReferenceSets {
  locationIds: Set<string>;
  npcIds: Set<string>;
  clueIds: Set<string>;
  itemIds: Set<string>;
  quests: WorldPack["quests"];
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

  conditionReferences.clueIds.forEach((clueId) => {
    if (!references.clueIds.has(clueId)) {
      errors.push(`${context} references missing clue: ${clueId}`);
    }
  });

  conditionReferences.npcIds.forEach((npcId) => {
    if (!references.npcIds.has(npcId)) {
      errors.push(`${context} references missing NPC: ${npcId}`);
    }
  });

  conditionReferences.questStages.forEach(({ questId, stage }) => {
    const quest = references.quests.find((candidate) => candidate.id === questId);
    if (!quest) {
      errors.push(formatMissingQuestMessage(context, questId));
    } else if (!quest.stages.includes(stage)) {
      errors.push(`${context} references missing quest stage: ${questId}.${stage}`);
    }
  });
}

function collectConditionReferences(condition: unknown): {
  locationIds: Set<string>;
  itemIds: Set<string>;
  clueIds: Set<string>;
  npcIds: Set<string>;
  questStages: Array<{ questId: string; stage: string }>;
} {
  const locationIds = new Set<string>();
  const itemIds = new Set<string>();
  const clueIds = new Set<string>();
  const npcIds = new Set<string>();
  const questStages: Array<{ questId: string; stage: string }> = [];

  function visit(node: unknown): void {
    if (!node || typeof node !== "object") {
      return;
    }

    if ("location_is" in node) {
      const value = (node as { location_is?: string }).location_is;
      if (value) {
        locationIds.add(value);
      }
    }

    if ("has_item" in node) {
      const value = (node as { has_item?: string }).has_item;
      if (value) {
        itemIds.add(value);
      }
    }

    if ("knows_clue" in node) {
      const value = (node as { knows_clue?: string }).knows_clue;
      if (value) {
        clueIds.add(value);
      }
    }

    if ("npc_attitude_at_least" in node) {
      const value = (node as { npc_attitude_at_least?: { npc?: string } }).npc_attitude_at_least;
      if (value?.npc) {
        npcIds.add(value.npc);
      }
    }

    if ("quest_stage_is" in node) {
      const value = (node as { quest_stage_is?: { quest?: string; stage?: string } }).quest_stage_is;
      if (value?.quest && value.stage) {
        questStages.push({ questId: value.quest, stage: value.stage });
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
  return { locationIds, itemIds, clueIds, npcIds, questStages };
}

function formatMissingQuestMessage(context: string, questId: string): string {
  const ending = context.match(/^Ending ([^ ]+) condition$/);
  if (ending) {
    return `Ending ${ending[1]} references missing quest: ${questId}`;
  }

  return `${context} references missing quest: ${questId}`;
}
