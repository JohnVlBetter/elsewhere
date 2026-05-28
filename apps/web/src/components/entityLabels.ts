export type EntitySummary = {
  id: string;
  name: string;
  assets?: {
    avatar?: string;
    portrait?: string;
    sceneImage?: string;
  };
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
  assets: Map<string, EntitySummary["assets"]>;
};

export function buildEntityMaps(entities: {
  locations: EntitySummary[];
  characters: EntitySummary[];
  items: EntitySummary[];
  facts: EntitySummary[];
  objectives: ObjectiveSummary[];
} | undefined): EntityMaps {
  const assets = new Map<string, EntitySummary["assets"]>();
  for (const entity of [
    ...(entities?.locations ?? []),
    ...(entities?.characters ?? []),
    ...(entities?.items ?? []),
    ...(entities?.facts ?? [])
  ]) {
    if (entity.assets) {
      assets.set(entity.id, mergeEntityAssets(assets.get(entity.id), entity.assets));
    }
  }

  return {
    locations: new Map((entities?.locations ?? []).map((entity) => [entity.id, entity.name])),
    characters: new Map((entities?.characters ?? []).map((entity) => [entity.id, entity.name])),
    items: new Map((entities?.items ?? []).map((entity) => [entity.id, entity.name])),
    facts: new Map((entities?.facts ?? []).map((entity) => [entity.id, entity.name])),
    objectives: new Map((entities?.objectives ?? []).map((entity) => [entity.id, entity])),
    assets
  };
}

export function labelEntity(map: Map<string, string>, id: string): string {
  return map.get(id) ?? id.replace(/[_:-]+/g, " ");
}

function mergeEntityAssets(
  current: EntitySummary["assets"] | undefined,
  candidate: EntitySummary["assets"]
): EntitySummary["assets"] {
  const merged: EntitySummary["assets"] = { ...current };
  for (const field of ["avatar", "portrait", "sceneImage"] as const) {
    if (candidate?.[field] !== undefined && merged[field] === undefined) {
      merged[field] = candidate[field];
    }
  }
  return merged;
}
