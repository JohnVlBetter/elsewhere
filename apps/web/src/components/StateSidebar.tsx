import type { SessionState } from "@aigame/shared";
import type { EntityMaps } from "./entityLabels";
import { labelEntity } from "./entityLabels";

type Labels = {
  location: string;
  facts: string;
  inventory: string;
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

  return (
    <aside className="state-sidebar" aria-label="故事状态">
      <section aria-label={labels.location}>
        <h2>{labels.location}</h2>
        <p>{currentLocation}</p>
      </section>
      <section aria-label={labels.facts}>
        <h2>{labels.facts}</h2>
        <p>{formatList(state?.knownFacts, entityMaps.facts, "还没有发现")}</p>
      </section>
      <section aria-label={labels.inventory}>
        <h2>{labels.inventory}</h2>
        <p>{formatList(state?.inventory, entityMaps.items, "暂未携带物品")}</p>
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

function formatObjectives(state: SessionState | undefined, entityMaps: EntityMaps): string {
  const rows = Object.entries(state?.objectiveStages ?? {});
  if (rows.length === 0) return "目标尚未展开";
  return rows
    .map(([id, stage]) => `${entityMaps.objectives.get(id)?.name ?? id}: ${stage}`)
    .join("、");
}
