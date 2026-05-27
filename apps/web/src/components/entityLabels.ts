export type EntitySummary = {
  id: string;
  name: string;
};

export type ObjectiveSummary = EntitySummary & {
  stages: string[];
};

export type EntityMaps = {
  locations: Map<string, string>;
  characters: Map<string, string>;
  items: Map<string, string>;
  facts: Map<string, string>;
  objectives: Map<string, ObjectiveSummary>;
};

export function buildEntityMaps(entities: {
  locations: EntitySummary[];
  characters: EntitySummary[];
  items: EntitySummary[];
  facts: EntitySummary[];
  objectives: ObjectiveSummary[];
} | undefined): EntityMaps {
  return {
    locations: new Map((entities?.locations ?? []).map((entity) => [entity.id, entity.name])),
    characters: new Map((entities?.characters ?? []).map((entity) => [entity.id, entity.name])),
    items: new Map((entities?.items ?? []).map((entity) => [entity.id, entity.name])),
    facts: new Map((entities?.facts ?? []).map((entity) => [entity.id, entity.name])),
    objectives: new Map((entities?.objectives ?? []).map((entity) => [entity.id, entity]))
  };
}

export function labelEntity(map: Map<string, string>, id: string): string {
  return map.get(id) ?? id.replace(/[_:-]+/g, " ");
}
