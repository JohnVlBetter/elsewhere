import { WorldPack } from "@aigame/shared";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateWorldPack(pack: WorldPack): ValidationResult {
  const errors: string[] = [];
  const locationIds = new Set(pack.locations.map((location) => location.id));
  const clueIds = new Set(pack.clues.map((clue) => clue.id));
  const questIds = new Set(pack.quests.map((quest) => quest.id));

  if (!locationIds.has(pack.manifest.entryLocationId)) {
    errors.push(`Entry location not found: ${pack.manifest.entryLocationId}`);
  }

  for (const location of pack.locations) {
    for (const exitId of location.exits) {
      if (!locationIds.has(exitId)) {
        errors.push(`Location ${location.id} exits to missing location: ${exitId}`);
      }
    }
  }

  for (const npc of pack.npcs) {
    for (const topic of npc.topics) {
      if (topic.revealsClueId && !clueIds.has(topic.revealsClueId)) {
        errors.push(`NPC ${npc.id} topic ${topic.id} reveals missing clue: ${topic.revealsClueId}`);
      }
    }
  }

  for (const quest of pack.quests) {
    if (!quest.stages.includes(quest.initialStage)) {
      errors.push(`Quest ${quest.id} initial stage is not in stages: ${quest.initialStage}`);
    }
  }

  for (const ending of pack.endings) {
    collectConditionReferences(ending.condition).questIds.forEach((questId) => {
      if (!questIds.has(questId)) {
        errors.push(`Ending ${ending.id} references missing quest: ${questId}`);
      }
    });
  }

  return { ok: errors.length === 0, errors };
}

function collectConditionReferences(condition: unknown): { questIds: Set<string> } {
  const questIds = new Set<string>();

  function visit(node: unknown): void {
    if (!node || typeof node !== "object") {
      return;
    }

    if ("quest_stage_is" in node) {
      const value = (node as { quest_stage_is?: { quest?: string } }).quest_stage_is;
      if (value?.quest) {
        questIds.add(value.quest);
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
  return { questIds };
}
