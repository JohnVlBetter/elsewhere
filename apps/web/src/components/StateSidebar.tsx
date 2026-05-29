import type { SessionState } from "@aigame/shared";
import type { EntityMaps } from "./entityLabels";
import { labelEntity } from "./entityLabels";
import { cssUrl } from "./packVisuals";

type Labels = {
  location: string;
  characters: string;
  facts: string;
  inventory: string;
  resources: string;
  relationships: string;
  objectives: string;
};

export function StateSidebar({
  state,
  labels,
  entityMaps
}: {
  state: SessionState | undefined;
  labels: Labels;
  entityMaps: EntityMaps;
}) {
  const currentLocation = state ? labelEntity(entityMaps.locations, state.currentLocationId) : "未知地点";
  const visibleCharacters = state
    ? entityMaps.locationCharacters.get(state.currentLocationId) ?? []
    : [];

  return (
    <aside className="state-sidebar" aria-label="故事状态" data-testid="state-sidebar">
      <section aria-label={labels.location}>
        <h2>{labels.location}</h2>
        <p>{currentLocation}</p>
      </section>
      <section aria-label={labels.characters}>
        <h2>{labels.characters}</h2>
        {visibleCharacters.length ? (
          <ul className="state-sidebar__list">
            {visibleCharacters.map((id) => {
              const avatarImage = cssUrl(entityMaps.assets.get(id)?.avatar ?? "");
              return (
                <li key={id} className="state-chip">
                  <span className="state-chip__avatar" data-has-image={Boolean(avatarImage)} style={avatarImage ? { backgroundImage: avatarImage } : undefined} aria-hidden="true" />
                  <span>{labelEntity(entityMaps.characters, id)}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p>当前没有可见角色</p>
        )}
      </section>
      <section aria-label={labels.facts}>
        <h2>{labels.facts}</h2>
        <p>{formatList(state?.knownFacts, entityMaps.facts, "还没有发现")}</p>
      </section>
      <section aria-label={labels.inventory}>
        <h2>{labels.inventory}</h2>
        <p>{formatList(state?.inventory, entityMaps.items, "暂未携带物品")}</p>
      </section>
      <section aria-label={labels.resources}>
        <h2>{labels.resources}</h2>
        <p>{formatValues(state?.resources, entityMaps.resources, "暂无资源")}</p>
      </section>
      <section aria-label={labels.relationships}>
        <h2>{labels.relationships}</h2>
        <p>{formatValues(state?.relationships, entityMaps.relationships, "暂无关系变化")}</p>
      </section>
      <section aria-label={labels.objectives}>
        <h2>{labels.objectives}</h2>
        <p>{formatObjectives(state, entityMaps)}</p>
      </section>
    </aside>
  );
}

function formatList(ids: string[] | undefined, map: Map<string, string>, emptyText: string): string {
  if (!ids?.length) return emptyText;
  return ids.map((id) => labelEntity(map, id)).join("、");
}

function formatValues(values: Record<string, number> | undefined, map: Map<string, string>, emptyText: string): string {
  const rows = Object.entries(values ?? {});
  if (rows.length === 0) return emptyText;
  return rows.map(([id, value]) => `${labelEntity(map, id)}: ${value}`).join("、");
}

function formatObjectives(state: SessionState | undefined, entityMaps: EntityMaps): string {
  const rows = Object.entries(state?.objectiveStages ?? {});
  if (rows.length === 0) return "目标尚未展开";
  return rows
    .map(([id, stage]) => `${entityMaps.objectives.get(id)?.name ?? id}: ${stage}`)
    .join("、");
}
