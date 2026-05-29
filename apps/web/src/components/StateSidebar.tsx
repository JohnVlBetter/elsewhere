import type { ComponentType, ReactNode } from "react";
import type { LucideProps } from "lucide-react";
import { Backpack, Flag, Gem, Handshake, Lightbulb, MapPin, Users } from "lucide-react";
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
    <aside className="state-sidebar grid min-h-0 content-start gap-3 overflow-auto" aria-label="故事状态" data-testid="state-sidebar">
      <StateSection label={labels.location} icon={MapPin}>
        <p className="m-0 leading-7 [overflow-wrap:anywhere]">{currentLocation}</p>
      </StateSection>
      <StateSection label={labels.characters} icon={Users}>
        {visibleCharacters.length ? (
          <ul className="state-sidebar__list m-0 grid list-none gap-2 p-0">
            {visibleCharacters.map((id) => {
              const avatarImage = cssUrl(entityMaps.assets.get(id)?.avatar ?? "");
              return (
                <li key={id} className="state-chip flex min-w-0 items-center gap-2 [overflow-wrap:anywhere]">
                  <span className="state-chip__avatar h-8 w-8 shrink-0 rounded-full border border-[rgba(82,104,122,0.22)] bg-[linear-gradient(145deg,var(--story-accent),#d7dde3)] bg-cover bg-center" data-has-image={Boolean(avatarImage)} style={avatarImage ? { backgroundImage: avatarImage } : undefined} aria-hidden="true" />
                  <span>{labelEntity(entityMaps.characters, id)}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="m-0 leading-7">当前没有可见角色</p>
        )}
      </StateSection>
      <StateSection label={labels.facts} icon={Lightbulb}>
        <p className="m-0 leading-7 [overflow-wrap:anywhere]">{formatList(state?.knownFacts, entityMaps.facts, "还没有发现")}</p>
      </StateSection>
      <StateSection label={labels.inventory} icon={Backpack}>
        <p className="m-0 leading-7 [overflow-wrap:anywhere]">{formatList(state?.inventory, entityMaps.items, "暂未携带物品")}</p>
      </StateSection>
      <StateSection label={labels.resources} icon={Gem}>
        <p className="m-0 leading-7 [overflow-wrap:anywhere]">{formatValues(state?.resources, entityMaps.resources, "暂无资源")}</p>
      </StateSection>
      <StateSection label={labels.relationships} icon={Handshake}>
        <p className="m-0 leading-7 [overflow-wrap:anywhere]">{formatValues(state?.relationships, entityMaps.relationships, "暂无关系变化")}</p>
      </StateSection>
      <StateSection label={labels.objectives} icon={Flag}>
        <p className="m-0 leading-7 [overflow-wrap:anywhere]">{formatObjectives(state, entityMaps)}</p>
      </StateSection>
    </aside>
  );
}

function StateSection({ label, icon: Icon, children }: { label: string; icon: ComponentType<LucideProps>; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-[var(--line)] bg-white p-4 shadow-[0_10px_28px_rgba(39,34,28,0.05)]" aria-label={label}>
      <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-[var(--accent-strong)]">
        <Icon className="h-4 w-4" aria-hidden="true" data-testid="state-section-icon" />
        {label}
      </h2>
      {children}
    </section>
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
